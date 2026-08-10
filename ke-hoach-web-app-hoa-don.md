# KẾ HOẠCH TRIỂN KHAI WEB APP TẠO & QUẢN LÝ HÓA ĐƠN

## 1. Tổng quan dự án

### 1.1. Mục tiêu

Xây dựng một web app nội bộ phục vụ việc:

- Quản lý danh mục sản phẩm.
- Đồng bộ sản phẩm thủ công từ Google Sheets.
- Tạo đơn hàng / hóa đơn nhanh.
- Hỗ trợ một hoặc nhiều sản phẩm trong cùng đơn.
- Tự động tính tiền sản phẩm, phí ship và tổng đơn.
- Lưu lịch sử đơn hàng.
- Copy nội dung đơn hàng để gửi qua Zalo/Messenger/Telegram/email.
- Xuất đơn hàng thành PNG.
- Xuất đơn hàng thành PDF.
- Lưu thông tin xuất hóa đơn VAT khi khách yêu cầu.
- Đảm bảo đơn hàng cũ không bị thay đổi khi giá sản phẩm sau này thay đổi.

---

## 2. Kiến trúc tổng thể

```text
                    GOOGLE SHEETS
                         │
                         │ Admin bấm "Đồng bộ"
                         ▼
                ┌─────────────────┐
                │   SYNC SERVICE  │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
Excel Import ──▶│    DATABASE     │
   (backup)     └────────┬────────┘
                         │
                        API
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
      Tạo đơn / hóa đơn       Quản lý sản phẩm
              │
              ▼
       Invoice Database
              │
        ┌─────┼─────┐
        │     │     │
        ▼     ▼     ▼
       Copy  PNG   PDF
```

## 3. Nguyên tắc kiến trúc

### 3.1. Google Sheets không phải database runtime

Frontend không đọc Google Sheets trực tiếp khi người dùng tạo đơn.

Luồng đúng:

```text
Google Sheets
      ↓
Manual Sync
      ↓
Database
      ↓
Backend API
      ↓
Web App
```

Lợi ích:

- Web app vẫn hoạt động nếu Google Sheets lỗi.
- Không phụ thuộc tốc độ Google API.
- Không gặp quota/rate limit khi sử dụng app.
- Dropdown sản phẩm tải nhanh.
- Dễ mở rộng sau này.
- Dễ kiểm soát dữ liệu.
- Dễ lưu lịch sử giá.

### 3.2. Không cần tự động sync

Do giá sản phẩm rất ít thay đổi, hiện tại không triển khai:

- Cron job.
- Polling 5 phút / 15 phút.
- Google Apps Script webhook.
- Background worker.
- Realtime synchronization.

Thay vào đó:

```text
Admin cập nhật Google Sheet
        ↓
Admin vào trang quản trị
        ↓
Bấm "Đồng bộ dữ liệu"
        ↓
Backend đọc Google Sheets
        ↓
Update database
```

## 4. Module hệ thống

1. Authentication / Admin
2. Product Management
3. Google Sheets Sync
4. Excel Import
5. Invoice Creation
6. Invoice Preview
7. Invoice Management
8. Copy Invoice
9. Export PNG
10. Export PDF
11. Settings

## 5. Cấu trúc dữ liệu sản phẩm

### 5.1. Google Sheet

Đề xuất mỗi dòng đại diện cho một biến thể sản phẩm.

| id | product_name | concentration | volume | price | active |
|---|---|---|---|---:|---|
| SP001 | Sản phẩm A | 10% | 30ml | 150000 | TRUE |
| SP002 | Sản phẩm A | 10% | 50ml | 200000 | TRUE |
| SP003 | Sản phẩm A | 20% | 30ml | 180000 | TRUE |
| SP004 | Sản phẩm B | 10% | 30ml | 120000 | TRUE |

`id` bắt buộc unique, không đổi sau khi tạo, không dùng tên sản phẩm làm ID.

## 6. Database Schema

Ưu tiên PostgreSQL. MySQL cũng có thể dùng.

### 6.1. Table `products`

```sql
products

id
external_id
name
concentration
volume
price
is_active
created_at
updated_at
last_synced_at
```

Constraint:

```sql
UNIQUE(external_id)
```

## 7. Đồng bộ Google Sheets

Trang quản trị:

```text
/admin/products
```

Hiển thị:

```text
Nguồn dữ liệu:
Google Sheets

Lần đồng bộ gần nhất:
10/08/2026 09:30

Tổng sản phẩm:
56

[ Đồng bộ dữ liệu ]
```

Sau khi đồng bộ:

```text
Đồng bộ thành công.

Thêm mới: 3
Cập nhật: 5
Không thay đổi: 48
Lỗi: 0
```

## 8. API đồng bộ

```http
POST /api/admin/products/sync
```

Chỉ Admin được phép gọi.

Quy trình:

1. Authenticate admin.
2. Connect Google Sheets.
3. Read rows.
4. Validate data.
5. Normalize data.
6. Tìm product bằng `external_id`.
7. Chưa tồn tại → INSERT.
8. Đã tồn tại → UPDATE nếu dữ liệu thay đổi.
9. Ghi `last_synced_at`.
10. Trả kết quả sync.

## 9. Validate dữ liệu Google Sheets

Kiểm tra:

- `external_id`: required
- `product_name`: required
- `price`: required, number, >= 0
- `volume`: required
- `concentration`: required
- `active`: boolean

Một dòng lỗi không được làm crash toàn bộ quá trình sync.

## 10. Excel Import

Excel chỉ đóng vai trò backup/fallback, không phải workflow chính.

Format Excel giống Google Sheets:

```text
id
product_name
concentration
volume
price
active
```

## 11. Trang tạo hóa đơn

Route đề xuất:

```text
/invoices/create
```

## 12. Form tạo hóa đơn

### Hàng 1

- Tên khách hàng
- Số điện thoại

### Hàng 2

- Địa chỉ giao hàng

### Hàng 3 — Sản phẩm

Radio:

- Một sản phẩm
- Nhiều sản phẩm

Frontend vẫn nên lưu tất cả dưới dạng mảng `items`.

Mỗi dòng sản phẩm gồm:

- Quantity tăng/giảm
- Dropdown tên sản phẩm
- Dropdown thể tích
- Dropdown nồng độ
- Giá
- Nút xóa khi có nhiều sản phẩm

### Dependent dropdown

Dropdown phải phụ thuộc vào biến thể thật trong database.

Flow đề xuất:

```text
Product Name
      ↓
Volume
      ↓
Concentration
      ↓
Resolve Product Variant
      ↓
Price
```

Quantity minimum = 1.

### Hàng 4 — Thanh toán

- Chuyển khoản
- COD

Enum:

```ts
BANK_TRANSFER
COD
```

### Hàng 5 — Vận chuyển

- Free ship
- Ship qua app giao hàng
- Ship qua xe / đơn vị vận chuyển

Enum:

```ts
FREE
DELIVERY_APP
COURIER
```

Nếu không phải `FREE` thì hiện input phí ship.

### Hàng 6 — Ghi chú

Textarea, không bắt buộc.

### Hàng 7 — Xuất hóa đơn

Radio:

- Không — mặc định
- Xuất hóa đơn

Nếu chọn xuất hóa đơn thì bắt buộc:

- Tên đơn vị
- Địa chỉ
- Email xuất hóa đơn

## 13. Realtime Invoice Preview

Desktop:

```text
┌─────────────────┬────────────────────┐
│                 │                    │
│      FORM       │  INVOICE PREVIEW   │
│                 │                    │
└─────────────────┴────────────────────┘
```

Mobile:

```text
FORM
↓
INVOICE PREVIEW
```

`InvoicePreview` phải là component riêng và reusable cho:

- Realtime preview
- Invoice detail
- Export PNG
- Export PDF
- Print

## 14. Layout Invoice Preview

Ví dụ:

```text
HÓA ĐƠN / ĐƠN HÀNG

Khách hàng: Nguyễn Văn A
SĐT: 0901234567

Địa chỉ:
123 Nguyễn Trãi, Hà Nội

-----------------------------------

2 × Sản phẩm A - 30ml - 10%
150.000đ × 2 = 300.000đ

1 × Sản phẩm B - 50ml - 20%
250.000đ × 1 = 250.000đ

-----------------------------------

Tiền hàng:
550.000đ

-----------------------------------

Thanh toán:
Chuyển khoản

Vận chuyển:
Ship qua app

Phí ship:
50.000đ

-----------------------------------

TỔNG CỘNG:
600.000đ
```

Nếu Free Ship thì không hiển thị dòng phí ship.

## 15. Công thức tính tiền

```text
line_total = quantity × unit_price

subtotal = SUM(line_total)

total = subtotal + shipping_fee
```

Nếu free ship:

```text
shipping_fee = 0
```

Tiền lưu dạng integer/numeric, không lưu chuỗi có ký hiệu `đ`.

Format frontend:

```ts
new Intl.NumberFormat("vi-VN").format(value)
```

## 16. Database hóa đơn

### Table `invoices`

```sql
id
invoice_number

customer_name
phone
address

payment_method

shipping_method
shipping_fee

subtotal
total

note

issue_invoice

company_name
invoice_address
invoice_email

created_by

created_at
updated_at
```

### Table `invoice_items`

```sql
id
invoice_id

product_id

product_name
volume
concentration

unit_price
quantity
line_total

created_at
```

## 17. Snapshot product data

Bắt buộc lưu snapshot tại thời điểm tạo hóa đơn:

- `product_name`
- `volume`
- `concentration`
- `unit_price`

Nếu sau này giá trong `products` đổi, hóa đơn cũ vẫn giữ nguyên giá cũ.

## 18. Tạo invoice backend

```http
POST /api/invoices
```

Payload ví dụ:

```json
{
  "customerName": "Nguyễn Văn A",
  "phone": "0901234567",
  "address": "Hà Nội",
  "items": [
    {
      "productId": "xxx",
      "quantity": 2
    }
  ],
  "paymentMethod": "BANK_TRANSFER",
  "shippingMethod": "DELIVERY_APP",
  "shippingFee": 50000,
  "note": "Giao sau 18h",
  "issueInvoice": true,
  "invoiceInfo": {
    "companyName": "ABC Company",
    "address": "Hà Nội",
    "email": "abc@example.com"
  }
}
```

Backend tuyệt đối không tin `unitPrice` frontend gửi lên.

Backend phải:

1. Validate payload.
2. Fetch product từ database.
3. Lấy giá hiện tại trong database.
4. Tính lại `line_total`.
5. Tính `subtotal`.
6. Validate shipping fee.
7. Tính `total`.
8. Lưu invoice + invoice_items trong transaction.
9. Return invoice hoàn chỉnh.

## 19. Invoice number

Đề xuất:

```text
HD-20260810-0001
```

Không dùng database ID thô làm mã hiển thị.

## 20. Sau khi tạo hóa đơn

Hiển thị:

- Copy hóa đơn
- Xuất PNG
- Xuất PDF
- Tạo hóa đơn mới

## 21. Copy hóa đơn

Copy plain text bằng:

```ts
navigator.clipboard.writeText(text)
```

Không copy HTML.

Ví dụ:

```text
Khách hàng: Nguyễn Văn A
SĐT: 0901234567
Địa chỉ: Hà Nội

2 × Sản phẩm A - 30ml - 10%
150.000đ × 2 = 300.000đ

--------------------

Tiền hàng: 300.000đ

Thanh toán: Chuyển khoản
Vận chuyển: Ship qua app
Phí ship: 50.000đ

--------------------

Tổng cộng: 350.000đ
```

## 22. Export PNG

Chỉ export `InvoicePreview`, không export form, navbar, buttons.

Khuyến nghị:

```text
html-to-image
```

Alternative:

```text
html2canvas
```

Yêu cầu:

- Background trắng
- Pixel ratio 2 hoặc 3
- Ảnh rõ
- Filename dạng:

```text
hoa-don-nguyen-van-a-2026-08-10.png
```

## 23. Export PDF

MVP dùng frontend:

```text
InvoicePreview
↓
image/canvas
↓
jsPDF
↓
PDF
```

Khuyến nghị:

```text
jsPDF
```

Format:

- A4
- portrait
- multi-page nếu nội dung dài

Filename:

```text
hoa-don-nguyen-van-a-2026-08-10.pdf
```

Server-side PDF bằng Playwright/Puppeteer chỉ cân nhắc sau nếu cần chất lượng print cao hơn.

## 24. Danh sách hóa đơn

Route:

```text
/invoices
```

Table:

- Mã hóa đơn
- Khách hàng
- SĐT
- Tổng tiền
- Thanh toán
- Ngày tạo
- Xem chi tiết

Search theo:

- Invoice number
- Customer name
- Phone

## 25. Trang chi tiết invoice

Route:

```text
/invoices/:id
```

Dùng lại `InvoicePreview`.

Actions:

- Copy
- PNG
- PDF

## 26. Product API

```http
GET /api/products
```

Chỉ trả:

```text
is_active = true
```

Nếu catalog nhỏ, API có thể trả toàn bộ variants một lần để frontend tự build dependent dropdown.

## 27. Product Management

Route:

```text
/admin/products
```

Table:

- Tên
- Nồng độ
- Thể tích
- Giá
- Trạng thái
- Updated At

Không khuyến nghị cho sửa trực tiếp product trong app nếu Google Sheets là source of truth.

Flow chuẩn:

```text
Sửa Google Sheet
↓
Bấm Sync
↓
Database update
```

Không hard delete sản phẩm đã từng dùng. Dùng:

```text
is_active = false
```

## 28. Authentication & Permission

Role:

### ADMIN

- Create invoice
- View invoices
- Export invoice
- Sync Google Sheets
- Import Excel
- Manage settings

### STAFF

- Create invoice
- View invoices
- Export invoice

Không được sync Google Sheets hoặc import Excel.

## 29. Google Sheets Authentication

Khuyến nghị Google Service Account.

Flow:

```text
Create Service Account
↓
Share Google Sheet cho email của Service Account
↓
Backend dùng credentials để đọc Sheet
```

Quyền Viewer là đủ nếu backend chỉ đọc.

Secrets lưu bằng environment variables / secret manager, không đưa xuống frontend.

## 30. Recommended tech stack

### Frontend + Backend

```text
Next.js
TypeScript
```

### UI

```text
Tailwind CSS
shadcn/ui
```

### Form

```text
React Hook Form
```

### Validation

```text
Zod
```

### Database

```text
PostgreSQL
```

### ORM

```text
Prisma
```

### Google Sheets

```text
googleapis
```

### PNG

```text
html-to-image
```

### PDF

```text
jsPDF
```

## 31. Project structure

```text
src/
│
├── app/
│   ├── login/
│   ├── invoices/
│   │   ├── page.tsx
│   │   ├── create/
│   │   │   └── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── admin/
│   │   └── products/
│   │       └── page.tsx
│   └── api/
│       ├── invoices/
│       ├── products/
│       └── admin/
│           └── products/
│               └── sync/
│
├── components/
│   ├── invoice/
│   │   ├── InvoiceForm.tsx
│   │   ├── InvoiceItemRow.tsx
│   │   ├── InvoicePreview.tsx
│   │   └── InvoiceActions.tsx
│   ├── product/
│   │   └── ProductSelector.tsx
│   └── ui/
│
├── lib/
│   ├── db.ts
│   ├── googleSheets.ts
│   ├── currency.ts
│   ├── invoice.ts
│   ├── exportPNG.ts
│   └── exportPDF.ts
│
├── server/
│   ├── services/
│   │   ├── invoice.service.ts
│   │   └── product-sync.service.ts
│   └── repositories/
│
└── types/
```

## 32. TypeScript models

```ts
type PaymentMethod =
    | "BANK_TRANSFER"
    | "COD"

type ShippingMethod =
    | "FREE"
    | "DELIVERY_APP"
    | "COURIER"
```

```ts
interface Product {
    id: string
    externalId: string
    name: string
    concentration: string
    volume: string
    price: number
    isActive: boolean
}
```

```ts
interface InvoiceFormData {
    customerName: string
    phone: string
    address: string
    items: InvoiceItemForm[]
    paymentMethod: PaymentMethod
    shippingMethod: ShippingMethod
    shippingFee: number
    note?: string
    issueInvoice: boolean
    companyName?: string
    invoiceAddress?: string
    invoiceEmail?: string
}
```

## 33. Responsive UX

Desktop:

- Form khoảng 55%
- Preview khoảng 45%
- Preview sticky

Mobile:

- Form
- Preview
- Actions

Product row mobile có thể chia:

```text
Product
Volume | Concentration
Quantity | Price
```

## 34. Performance

Với catalog nhỏ:

```http
GET /api/products
```

một lần khi load trang là đủ.

Có thể cache bằng React Query hoặc Next.js data fetching.

Không cần optimization phức tạp.

## 35. Sync log

Nên có table:

```sql
product_sync_logs
```

Fields:

```text
id
source
created_count
updated_count
unchanged_count
error_count
status
error_message
started_at
completed_at
created_by
```

## 36. MVP Scope

### Bắt buộc

- Google Sheets manual sync
- Product database
- Product selector
- Dependent dropdown
- Create invoice
- Multiple products
- Shipping
- Payment
- Notes
- Invoice company info
- Realtime calculation
- Database persistence
- Invoice preview
- Copy text
- PNG
- PDF
- Invoice list
- Invoice detail

### Chưa cần

- Realtime Google Sheet sync
- Cron
- Webhook
- Inventory management
- Payment gateway
- E-invoice API integration
- Zalo API
- Email automation
- CRM
- Advanced analytics

## 37. Thứ tự triển khai

1. Setup project + database
2. Product schema
3. Google Sheets manual sync
4. Product API
5. Invoice form
6. Calculation
7. Invoice save API
8. InvoicePreview
9. Invoice history
10. Copy
11. PNG
12. PDF
13. Excel backup import
14. UI polishing

## 38. Testing checklist

### Product sync

- [ ] Google Sheet connection thành công
- [ ] Sheet sai permission
- [ ] Sheet không tồn tại
- [ ] Row thiếu product ID
- [ ] Row thiếu giá
- [ ] Giá không phải number
- [ ] Duplicate product ID
- [ ] Product mới
- [ ] Product update giá
- [ ] Product đổi volume
- [ ] Product inactive
- [ ] Sync không làm mất invoice lịch sử

### Invoice

- [ ] Một sản phẩm
- [ ] Nhiều sản phẩm
- [ ] Quantity tăng
- [ ] Quantity giảm
- [ ] Quantity không dưới 1
- [ ] Variant đúng
- [ ] Giá đúng
- [ ] Line total đúng
- [ ] Subtotal đúng
- [ ] Free ship
- [ ] Delivery app
- [ ] Courier
- [ ] Shipping fee đúng
- [ ] Grand total đúng

### Xuất hóa đơn

- [ ] Default = Không
- [ ] Chọn Xuất hóa đơn hiện fields
- [ ] Thiếu company name báo lỗi
- [ ] Thiếu address báo lỗi
- [ ] Email invalid báo lỗi
- [ ] Preview hiện thông tin đúng

### Historical price

1. Product A = 150.000đ
2. Tạo invoice #001
3. Đổi giá Google Sheet thành 180.000đ
4. Sync
5. Mở invoice #001

Expected:

- Invoice #001 vẫn là 150.000đ
- Invoice mới dùng 180.000đ

### Export

- [ ] Copy text đúng
- [ ] Tiếng Việt không lỗi
- [ ] PNG không chứa buttons
- [ ] PNG nền trắng
- [ ] PNG rõ nét
- [ ] Filename đúng
- [ ] PDF đúng layout
- [ ] PDF filename đúng
- [ ] Multi-product invoice không overflow
- [ ] Invoice dài xuất PDF được

## 39. Definition of Done

Feature chỉ được coi là hoàn thành nếu:

- Code hoàn chỉnh
- Validation đầy đủ
- Có error handling
- Responsive
- Không console error
- Không TypeScript error
- Database migration hoàn chỉnh
- API đã test
- UI đã test
- Calculation đã test
- Historical invoice không thay đổi
- PNG hoạt động
- PDF hoạt động
- Copy hoạt động

## 40. Các nguyên tắc dev không được vi phạm

1. Không đọc Google Sheets trực tiếp từ frontend.
2. Không lấy Google Sheets làm database runtime.
3. Không cần cron sync ở version hiện tại.
4. Không tính tổng tiền chỉ ở frontend.
5. Không tin `unitPrice` frontend gửi lên.
6. Invoice item phải snapshot giá và tên sản phẩm.
7. Không update invoice cũ khi giá sản phẩm thay đổi.
8. Không hard delete product đã từng được dùng.
9. `InvoicePreview` phải là reusable component.
10. Tiền lưu dạng numeric/integer, không lưu chuỗi có ký hiệu tiền.

## 41. User flow cuối cùng

### Admin cập nhật sản phẩm

```text
Google Sheets
↓
Sửa giá / thêm sản phẩm
↓
Web App Admin
↓
Đồng bộ dữ liệu
↓
Done
```

### Staff tạo đơn

```text
Mở Tạo hóa đơn
↓
Nhập khách hàng
↓
Chọn sản phẩm
↓
Chọn số lượng
↓
Chọn thanh toán
↓
Chọn vận chuyển
↓
Nhập ghi chú
↓
Chọn có/không xuất hóa đơn
↓
Kiểm tra Preview
↓
Tạo hóa đơn
```

### Sau khi tạo

```text
Invoice được lưu database
↓
Hiển thị Preview cuối
↓
Copy / PNG / PDF
↓
Tạo đơn tiếp theo
```

## 42. Acceptance Criteria tổng thể

Project được coi là đạt yêu cầu khi:

1. Admin có thể bấm một nút để đồng bộ danh mục từ Google Sheets.
2. Không cần Google Sheets hoạt động trong lúc staff tạo hóa đơn.
3. Staff có thể tạo đơn với một hoặc nhiều sản phẩm.
4. Dropdown chỉ cho phép chọn các variant tồn tại.
5. Giá được lấy từ database.
6. Backend tự tính lại toàn bộ tiền đơn hàng.
7. Free ship không hiển thị dòng phí ship.
8. Ship trả phí được cộng đúng vào tổng đơn.
9. Có thể nhập ghi chú.
10. Có thể bật/tắt yêu cầu xuất hóa đơn.
11. Khi yêu cầu xuất hóa đơn, các field liên quan trở thành bắt buộc.
12. Hóa đơn được lưu vào database.
13. Giá tại thời điểm bán được snapshot vào `invoice_items`.
14. Thay đổi giá sản phẩm không ảnh hưởng hóa đơn cũ.
15. Có lịch sử hóa đơn.
16. Có trang xem lại từng hóa đơn.
17. Copy hóa đơn cho ra plain text dễ gửi qua ứng dụng chat.
18. PNG chỉ chứa nội dung invoice.
19. PDF sử dụng cùng layout invoice.
20. Ứng dụng hoạt động tốt trên desktop và sử dụng được trên mobile.

## 43. Kết luận kiến trúc

```text
Google Sheets
      │
      │ Manual Sync
      ▼
PostgreSQL
      │
      ▼
Backend API
      │
      ▼
Next.js Web App
      │
      ├── Create Invoice
      ├── Invoice History
      ├── Copy
      ├── PNG
      └── PDF
```

Google Sheets chỉ đóng vai trò Product Master Data Editor.

Database mới là source of truth cho quá trình vận hành web app.

Invoice khi được tạo phải trở thành dữ liệu lịch sử độc lập, không phụ thuộc vào giá sản phẩm hiện tại.
