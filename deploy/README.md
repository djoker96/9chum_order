# Runbook production cho `donhang.9chum.vn`

Runbook này cố ý tách bootstrap một lần khỏi release hằng ngày. Portainer chỉ dùng để quan sát container/log; cấu hình production và release đi qua image/bundle bất biến từ GitHub Actions. Stack được tạo ngoài Portainer nên quyền quản lý có giới hạn theo mô hình [Portainer access control](https://docs.portainer.io/sts/advanced/access-control).

## 1. Điều kiện dừng trước mọi thay đổi VPS

Chỉ tiếp tục sau audit read-only bằng `scripts/deploy/audit-vps.sh`. Dừng nếu có một trong các điều kiện sau:

- RAM dưới 2 GiB;
- Docker không ở standalone mode;
- VPS không phải `x86_64` trong khi workflow đang phát hành image `linux/amd64`;
- không có cổng loopback trống trong `3101–3199`;
- LiteSpeed/VPanel, firewall hoặc cơ chế backup hiện hữu không thể cô lập an toàn;
- không xác định được file cấu hình do VPanel quản lý hoặc cách graceful reload mà VPanel không ghi đè;
- chưa xác định vùng backup được hệ thống ngoài máy chủ thu thập, mã hóa và giữ lại.

Audit phải lưu lại: RAM/disk, Docker/Compose/Portainer, listener và firewall, network/volume hiện có, layout LiteSpeed/VPanel, certificate hiện tại, ACME renewal, timer/cron và vùng backup. Không chạy bootstrap chỉ dựa vào cờ `--audit-approved` nếu chưa đọc kết quả.

## 2. Khóa SSH và GitHub Secrets

1. Dùng khóa root tạm thời chỉ cho audit/bootstrap. Không commit khóa vào repo.
2. Sau audit, tạo khóa Ed25519 riêng cho account `donhang-deploy`.
3. Bootstrap cài forced command chỉ chấp nhận chính xác `deploy <40-char-lowercase-sha>`, tắt TTY, password và forwarding. Account chỉ được `sudo` launcher release.
4. GitHub Environment `production` chỉ lưu:
   - `DEPLOY_SSH_PRIVATE_KEY`;
   - `DEPLOY_SSH_KNOWN_HOSTS` — toàn bộ dòng OpenSSH `known_hosts`, được lấy và đối chiếu fingerprint trong phiên root đã audit.
5. Không đưa password DB/admin hoặc runtime env vào GitHub.
6. Gỡ khóa root tạm khỏi `root/.ssh/authorized_keys` ngay sau bàn giao, rồi thử lại để chắc chắn khóa đó không còn đăng nhập được.

## 3. Bootstrap một lần

Từ bundle đã review trên VPS, chạy với quyền root:

```bash
scripts/deploy/bootstrap-vps.sh \
  --audit-approved \
  --deploy-public-key-file /root/donhang-deploy.pub \
  --backup-dir /var/backups/donhang-9chum
```

Chỉ thêm `--install-backup-timer` sau khi vùng `/var/backups/donhang-9chum` đã được backup collector hiện hữu thu thập và kiểm tra quyền đọc. Bootstrap tạo ba password ngẫu nhiên độc lập:

- `donhang_admin`: superuser chỉ nằm trong container DB;
- `donhang_migrator`: owner schema/database, chỉ image ops dùng;
- `donhang_app`: chỉ DML cần thiết, app dùng và không có DDL.

File `/opt/donhang-9chum/runtime.env` phải là `root:root 0600`. PostgreSQL không publish port; app chỉ bind `127.0.0.1:$APP_PORT`.

## 4. GHCR và release thủ công

Package GHCR mới mặc định có thể là private. Lần chạy workflow đầu tiên được phép build/push nhưng sẽ dừng ở gate anonymous pull trước SSH. Sau đó đổi package `9chum_order` sang **Public** trong GitHub Package settings và chạy lại cùng SHA. Workflow không ghi đè tag đã tồn tại: app/ops nào đã có sẽ được pull và phải có đúng OCI source/revision; image còn thiếu mới được build, scan và push. Nhờ vậy retry an toàn cả khi lần push trước chỉ hoàn thành một image.

Release production chỉ chạy bằng **Actions → Release production → Run workflow** trên nhánh `main`. Chuỗi thực thi:

1. CI đầy đủ;
2. build/scan hoặc kiểm tra lại image SHA có sẵn;
3. chứng minh app/ops pull được khi đã logout GHCR;
4. SSH forced command;
5. launcher pull ops image, kiểm checksum và giải nén deployment bundle bất biến;
6. pull app image;
7. nếu DB đang chạy, dump trước mọi Compose reconciliation;
8. start/health DB digest-pinned, dump first-boot nếu cần;
9. `prisma migrate deploy` bằng `donhang_migrator`;
10. cập nhật app, chờ health loopback rồi smoke HTTPS;
11. chỉ sau thành công mới cập nhật `current-sha` và bundle `current`.

Nếu app health/smoke thất bại, script đưa app về SHA trước. Migration DB không tự rollback; dùng dump trước migration để phục hồi có kiểm soát. PostgreSQL được pin theo digest và không được nâng cấp trong một app release. Nâng cấp DB là maintenance riêng, luôn dump/restore-drill trước.

## 5. LiteSpeed/VPanel và TLS — bắt buộc audit theo host

Không chép một `vhconf.conf` mẫu đè lên VPanel. Từ layout đã audit, tạo virtual host riêng cho `donhang.9chum.vn`, map đúng listener 80/443 và giữ bản sao cấu hình trước thay đổi.

Yêu cầu bắt buộc của vhost:

- Web Server External App trỏ duy nhất tới `127.0.0.1:$APP_PORT`, không dùng public IP;
- proxy context `/`, response buffering **No**, tối đa khoảng 100 connection;
- request body limit khoảng 6 MiB;
- không bật LSCache cho HTML/API động;
- backend nhận `Host`/`X-Forwarded-Host` cố định là `donhang.9chum.vn` và `X-Forwarded-Proto` cố định theo listener;
- header `X-Forwarded-For` do LiteSpeed tạo/append từ peer thực; không được tin giá trị đầu do client gửi. Ứng dụng chỉ dùng địa chỉ hợp lệ cuối cùng;
- dùng `RequestHeader`/surface tương đương mà phiên bản LiteSpeed đã audit hỗ trợ để **unset rồi set** các header proxy; không giả định cú pháp trước khi chạy config test;
- listener 80 chỉ redirect sang HTTPS;
- listener/vhost 443 dùng certificate có SAN `donhang.9chum.vn`;
- giữ nguyên CSP, HSTS và các security header do Next.js trả về.

OpenLiteSpeed mô tả external app/proxy context và khuyến nghị tắt response buffering tại [Reverse Proxy](https://docs.openlitespeed.org/config/reverseproxy/). Cấu hình certificate/listener được mô tả tại [SSL](https://docs.openlitespeed.org/security/ssl/). LiteSpeed hỗ trợ custom proxy request headers bằng `RequestHeader`; phải kiểm tra chính phiên bản đang chạy trước khi áp dụng.

Certificate ACME dùng email `datjoker96@gmail.com`. Sau khi cấp, cấu hình fullchain/private key đúng vhost, chạy config test, graceful reload, kiểm tra timer tự gia hạn và renewal hook reload LiteSpeed. Không restart mù nếu config test thất bại.

## 6. Gate proxy/firewall trước release đầu tiên

Phải chứng minh tất cả điều sau:

```bash
curl -I http://donhang.9chum.vn
curl -fsS https://donhang.9chum.vn/api/health
openssl s_client -connect donhang.9chum.vn:443 -servername donhang.9chum.vn </dev/null
ss -lntp
```

- HTTP trả redirect HTTPS;
- certificate đúng hostname/chain/thời hạn;
- Internet không truy cập được `$APP_PORT` hay `5432`;
- nếu host dùng CSF với outbound policy `DROP`, release ghi rule root-owned chỉ cho phép Docker proxy tới subnet app ở TCP `3000` và chèn rule runtime tương ứng (không mở `$APP_PORT` ra Internet); release **không** reload CSF vì cấu hình CSF không tích hợp Docker sẽ xoá chain `DOCKER-*`;
- không chạy `csf -r` thủ công khi Docker đang quản lý network nếu chưa bật/tích hợp Docker đúng cách; sau thay đổi firewall phải kiểm tra lại `docker network`, NAT và các proxy hiện hữu;
- `Host` lạ không vào vhost;
- same-origin thật thành công, `Origin: https://attacker.example` trả 403;
- gửi nhiều login request với `X-Forwarded-For` giả khác nhau vẫn bị 429 theo IP thực, chứng minh proxy không cho bypass rate limit;
- response `/api/health` và trang app còn CSP/HSTS/no-sniff/frame/referrer headers.

Nếu chưa qua gate header trust thì **không deploy**, vì rate limiter phụ thuộc LiteSpeed thêm địa chỉ peer thật ở cuối `X-Forwarded-For`.

## 7. Seed admin một lần

Sau release khỏe đầu tiên, đăng nhập VPS bằng phiên root được kiểm soát và chạy:

```bash
/usr/local/sbin/donhang-seed-admin
```

Nhập mật khẩu ẩn cho `datjoker96@gmail.com` hai lần. Password chỉ tồn tại trong process seed, không được ghi vào stack/runtime env/GitHub. Marker ngăn seed lại; script cũng từ chối reset nếu email đã tồn tại.

## 8. Backup, restore và giám sát

Timer chạy 02:00 `Asia/Ho_Chi_Minh`. Backup hằng ngày và release dùng chung maintenance lock để không chồng migrations. Mỗi dump có:

- `.dump` custom-format, no owner/ACL;
- `.meta` chứa count/hash của toàn bộ bảng ứng dụng và invoice-number sequence tại snapshot ổn định;
- `.sha256` bảo vệ cả dump và metadata.

Restore drill:

```bash
/usr/local/sbin/donhang-verify-restore /var/backups/donhang-9chum/<file>.dump
```

Drill kiểm checksum, restore vào PostgreSQL tạm bằng role production-equivalent, so metadata, thử read + rollback-only DML bằng runtime role và xác nhận runtime role không có DDL.

Trước khi bật timer, ghi nhận trong ticket vận hành: collector nào lấy thư mục, encryption at rest/in transit, retention, dung lượng/cảnh báo, quyền restore và lần restore drill gần nhất. `Persistent=true` giúp timer chạy bù sau reboot; lỗi backup phải được hệ thống giám sát cảnh báo, không chỉ nằm trong journal.

## 9. Nghiệm thu chức năng

Qua HTTPS thật, kiểm tra admin login, tạo hóa đơn và lịch sử, tạo/vô hiệu hóa staff rồi xác nhận staff bị chặn login, import một file Excel hợp lệ, forged origin, restart app không mất dữ liệu và restore drill giữ nguyên invoice/sequence. Google Sheets cố ý để trống ở đợt đầu.

Cuối cùng lưu audit/acceptance record, fingerprint deploy key, SHA đang chạy, vị trí backup và kết quả restore drill; không lưu secret.

## 10. Cấu hình Google Sheets để import sản phẩm

Luồng import là một chiều: admin bấm **Đồng bộ Google Sheets**, backend đọc tab sản phẩm bằng Service Account rồi upsert vào PostgreSQL. Frontend không gọi Google Sheets trực tiếp. Google Sheets là nguồn dữ liệu chuẩn cho danh mục; thứ tự các dòng dữ liệu (không tính hàng tiêu đề) được lưu để dropdown hóa đơn hiển thị đúng thứ tự trong Sheet.

### Chuẩn bị Google Cloud

1. Chọn hoặc tạo một Google Cloud project và bật **Google Sheets API**.
2. Tạo một **Service Account**, sau đó lấy `project_id`, `client_email` và private key JSON.
3. Không commit private key vào Git hoặc đưa vào trình duyệt. Chỉ đặt ba giá trị này trong runtime secret của app:

   ```env
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_CLIENT_EMAIL=product-import@your-project-id.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="private-key-value-with-\n-escapes"
   ```

   Ứng dụng tự đổi chuỗi `\n` thành newline trước khi tạo Google API client.

### Tạo Sheet sản phẩm

Tạo một spreadsheet, đặt tên tab là `Products` (hoặc tên khác nếu sẽ nhập trong trang quản trị), rồi dùng đúng hàng tiêu đề sau:

```csv
id,product_name,concentration,volume,price,active
SP001,Sản phẩm A,10%,30ml,150000,TRUE
SP002,Sản phẩm B,20%,50ml,250000,FALSE
```

Chia sẻ spreadsheet cho `GOOGLE_CLIENT_EMAIL` với quyền **Viewer**. Mã `id` phải duy nhất; `price` là số nguyên VNĐ không âm; `active` nhận `TRUE/FALSE`, `1/0`, `yes/no` hoặc `có/không`. Có thể tải mẫu tại `/templates/products-import.csv` ngay trên trang quản trị.

### Kết nối trong ứng dụng

1. Đảm bảo migration đã chạy: `npx prisma migrate deploy`.
2. Đăng nhập tài khoản ADMIN và mở `/admin/products`.
3. Dán URL spreadsheet, nhập đúng tên tab, bấm **Lưu cấu hình**.
4. Bấm **Đồng bộ Google Sheets**. Kết quả hiển thị số dòng tạo mới, cập nhật, vô hiệu hóa, không đổi và lỗi.

Chỉ sản phẩm `active` mới xuất hiện và được chọn khi tạo hóa đơn. Một lần đồng bộ Google Sheets hoàn chỉnh (không có dòng lỗi và có ít nhất một dòng hợp lệ) sẽ chuyển các sản phẩm active có `id` không còn trong Sheet sang `Inactive`; dữ liệu không bị xóa để giữ lịch sử hóa đơn. Sheet rỗng hoặc đồng bộ partial không thực hiện bước vô hiệu hóa để tránh làm mất danh mục do cấu hình sai. Import Excel chỉ là luồng fallback/additive-update và không reconcile các ID bị thiếu.

Nếu nút đồng bộ bị khóa, kiểm tra đủ ba biến credential trên server và quyền Viewer của Service Account. Sau lần sync đầu tiên, kiểm tra số lượng `vô hiệu hóa` và danh sách Inactive trong trang quản trị trước khi nghiệm thu dropdown hóa đơn.

Tài liệu tham khảo: [Google Sheets API Node.js quickstart](https://developers.google.com/workspace/sheets/api/quickstart/nodejs), [tạo Service Account](https://cloud.google.com/iam/docs/service-accounts-create), [chia sẻ spreadsheet](https://support.google.com/docs/answer/9331169).
