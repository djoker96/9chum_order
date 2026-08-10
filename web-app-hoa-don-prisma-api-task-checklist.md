# WEB APP QUẢN LÝ & XUẤT HÓA ĐƠN
## Prisma Schema + API Contract + Task Checklist triển khai

> Tài liệu này là bản kỹ thuật hóa của kế hoạch MVP trước đó, dùng để bàn giao trực tiếp cho dev Backend / Frontend / Admin.
>
> Stack mục tiêu:
>
> - Next.js App Router
> - TypeScript
> - PostgreSQL
> - Prisma ORM
> - React Hook Form
> - Zod
> - Tailwind CSS / shadcn/ui
> - Google Sheets API
> - html-to-image
> - jsPDF

---

# 1. Phạm vi MVP đã chốt

Ứng dụng phục vụ:

- Đăng nhập nhân viên / admin.
- Đồng bộ danh mục sản phẩm thủ công từ Google Sheets.
- Không realtime sync.
- Không cron.
- Google Sheets không phải runtime database.
- Tạo hóa đơn với một hoặc nhiều sản phẩm.
- Chọn biến thể sản phẩm theo:
  - Tên sản phẩm
  - Thể tích
  - Nồng độ
- Tự tính:
  - Thành tiền từng dòng
  - Tổng tiền sản phẩm
  - Phí ship
  - Tổng đơn hàng
- Lưu lịch sử hóa đơn.
- Snapshot giá sản phẩm tại thời điểm tạo hóa đơn.
- Preview hóa đơn realtime.
- Copy nội dung hóa đơn.
- Export PNG.
- Export PDF.
- Import Excel chỉ là phương án backup.
- Có quyền ADMIN / STAFF.

---

# 2. Nguyên tắc dữ liệu quan trọng

## 2.1. Google Sheets chỉ là Product Master Data Editor

Luồng:

```text
Google Sheets
    ↓
Admin bấm Sync
    ↓
Backend
    ↓
PostgreSQL
    ↓
Web App
```

Frontend không gọi trực tiếp Google Sheets.

---

## 2.2. Hóa đơn phải snapshot dữ liệu sản phẩm

Ví dụ giá hiện tại:

```text
Product A = 150.000đ
```

Tạo hóa đơn:

```text
2 × 150.000đ = 300.000đ
```

Ba tháng sau giá đổi:

```text
Product A = 180.000đ
```

Hóa đơn cũ vẫn phải giữ:

```text
150.000đ / sản phẩm
```

Vì vậy `InvoiceItem` phải lưu:

```text
productName
volume
concentration
unitPrice
quantity
lineTotal
```

không chỉ lưu `productId`.

---

# 3. Prisma Schema đề xuất

File:

```text
prisma/schema.prisma
```

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  STAFF
}

enum PaymentMethod {
  BANK_TRANSFER
  COD
}

enum ShippingMethod {
  FREE
  DELIVERY_APP
  COURIER
}

enum InvoiceStatus {
  CONFIRMED
  CANCELLED
}

enum SyncSource {
  GOOGLE_SHEETS
  EXCEL
}

enum SyncStatus {
  SUCCESS
  PARTIAL
  FAILED
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String?
  role         UserRole @default(STAFF)
  isActive     Boolean  @default(true) @map("is_active")

  invoices     Invoice[]
  syncLogs     ProductSyncLog[]

  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@index([role])
  @@index([isActive])
  @@map("users")
}

model Product {
  id            String   @id @default(cuid())

  externalId    String   @unique @map("external_id")
  name          String
  concentration String
  volume        String

  price         Decimal  @db.Decimal(14, 0)

  isActive      Boolean  @default(true) @map("is_active")

  lastSyncedAt  DateTime? @map("last_synced_at")

  invoiceItems  InvoiceItem[]

  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@index([name])
  @@index([isActive])
  @@index([name, volume, concentration])
  @@map("products")
}

model Invoice {
  id             String          @id @default(cuid())
  invoiceNumber  String          @unique @map("invoice_number")

  customerName   String          @map("customer_name")
  phone          String
  address        String

  paymentMethod  PaymentMethod   @map("payment_method")

  shippingMethod ShippingMethod  @map("shipping_method")
  shippingFee    Decimal         @default(0) @db.Decimal(14, 0) @map("shipping_fee")

  subtotal       Decimal         @db.Decimal(14, 0)
  total          Decimal         @db.Decimal(14, 0)

  note           String?

  issueInvoice   Boolean         @default(false) @map("issue_invoice")

  companyName    String?         @map("company_name")
  invoiceAddress String?         @map("invoice_address")
  invoiceEmail   String?         @map("invoice_email")

  status         InvoiceStatus   @default(CONFIRMED)

  createdById    String          @map("created_by_id")
  createdBy      User            @relation(fields: [createdById], references: [id], onDelete: Restrict)

  items          InvoiceItem[]

  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  @@index([invoiceNumber])
  @@index([customerName])
  @@index([phone])
  @@index([createdAt])
  @@index([createdById])
  @@index([status])
  @@map("invoices")
}

model InvoiceItem {
  id            String   @id @default(cuid())

  invoiceId     String   @map("invoice_id")
  invoice       Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  productId     String?  @map("product_id")
  product       Product? @relation(fields: [productId], references: [id], onDelete: SetNull)

  // Snapshot data tại thời điểm tạo hóa đơn
  productName   String   @map("product_name")
  volume        String
  concentration String

  unitPrice     Decimal  @db.Decimal(14, 0) @map("unit_price")
  quantity      Int
  lineTotal     Decimal  @db.Decimal(14, 0) @map("line_total")

  createdAt     DateTime @default(now()) @map("created_at")

  @@index([invoiceId])
  @@index([productId])
  @@map("invoice_items")
}

model ProductSyncLog {
  id             String      @id @default(cuid())

  source         SyncSource
  status         SyncStatus

  createdCount   Int         @default(0) @map("created_count")
  updatedCount   Int         @default(0) @map("updated_count")
  unchangedCount Int         @default(0) @map("unchanged_count")
  skippedCount   Int         @default(0) @map("skipped_count")
  errorCount     Int         @default(0) @map("error_count")

  errorMessage   String?     @map("error_message")
  detailJson     Json?       @map("detail_json")

  startedAt      DateTime    @default(now()) @map("started_at")
  completedAt    DateTime?   @map("completed_at")

  createdById    String      @map("created_by_id")
  createdBy      User        @relation(fields: [createdById], references: [id], onDelete: Restrict)

  @@index([source])
  @@index([status])
  @@index([startedAt])
  @@index([createdById])
  @@map("product_sync_logs")
}
```

---

# 4. Giải thích lựa chọn schema

## 4.1. Tiền dùng `Decimal`

Không dùng `Float`.

Các field:

```text
price
unitPrice
lineTotal
shippingFee
subtotal
total
```

dùng:

```prisma
Decimal @db.Decimal(14, 0)
```

Do hệ thống dùng VND và không cần số lẻ.

---

## 4.2. `productId` trong InvoiceItem cho phép null

```prisma
productId String?
```

Lý do:

- Nếu product bị xóa logic hoặc migrate dữ liệu sau này, invoice lịch sử vẫn tồn tại.
- Snapshot vẫn giữ đầy đủ tên / volume / nồng độ / giá.

Tuy nhiên trong vận hành MVP:

- Không hard delete Product.
- Chỉ dùng `isActive = false`.

---

## 4.3. Không lưu shipping fee âm

Validation application-level:

```text
shippingFee >= 0
```

Nếu:

```text
shippingMethod = FREE
```

backend bắt buộc normalize:

```text
shippingFee = 0
```

---

# 5. Migration & seed

## 5.1. Dev setup

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Production:

```bash
npx prisma migrate deploy
```

---

## 5.2. Seed admin đầu tiên

Đề xuất:

```text
prisma/seed.ts
```

Seed:

```text
ADMIN_EMAIL
ADMIN_PASSWORD
```

Password phải hash trước khi lưu.

Không commit password thật vào Git.

---

# 6. Google Sheet schema

Sheet name:

```text
Products
```

Columns:

| Column | Required | Example |
|---|---:|---|
| id | Yes | SP001 |
| product_name | Yes | Sản phẩm A |
| concentration | Yes | 10% |
| volume | Yes | 30ml |
| price | Yes | 150000 |
| active | Yes | TRUE |

Rule:

```text
id = external_id
```

Không dùng row number làm ID.

---

# 7. Validation Google Sheets

Mỗi row phải validate:

```ts
{
  id: string().min(1),
  product_name: string().min(1),
  concentration: string().min(1),
  volume: string().min(1),
  price: number().nonnegative(),
  active: boolean()
}
```

Các lỗi cần phát hiện:

- ID trống.
- ID duplicate trong cùng Sheet.
- Giá trống.
- Giá không phải số.
- Giá âm.
- Tên trống.
- Volume trống.
- Concentration trống.
- Active không parse được.

---

# 8. Quy tắc sync sản phẩm

Pseudo-code:

```ts
for (const row of normalizedRows) {
  const existing = await prisma.product.findUnique({
    where: {
      externalId: row.id
    }
  })

  if (!existing) {
    await prisma.product.create({
      data: {
        externalId: row.id,
        name: row.productName,
        volume: row.volume,
        concentration: row.concentration,
        price: row.price,
        isActive: row.active,
        lastSyncedAt: new Date()
      }
    })

    createdCount++
    continue
  }

  if (hasChanged(existing, row)) {
    await prisma.product.update({
      where: {
        id: existing.id
      },
      data: {
        name: row.productName,
        volume: row.volume,
        concentration: row.concentration,
        price: row.price,
        isActive: row.active,
        lastSyncedAt: new Date()
      }
    })

    updatedCount++
  } else {
    unchangedCount++
  }
}
```

Không tự động inactive product chỉ vì row bị xóa khỏi Sheet.

Muốn ngừng bán:

```text
active = FALSE
```

---

# 9. API Design

Base URL:

```text
/api
```

Response format thống nhất:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "fields": {}
  }
}
```

---

# 10. Authentication API

## POST `/api/auth/login`

Role:

```text
PUBLIC
```

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_xxx",
      "name": "Admin",
      "email": "admin@example.com",
      "role": "ADMIN"
    }
  }
}
```

Errors:

```text
401 INVALID_CREDENTIALS
403 USER_DISABLED
```

---

## POST `/api/auth/logout`

Role:

```text
AUTHENTICATED
```

Response:

```json
{
  "success": true
}
```

---

## GET `/api/auth/me`

Role:

```text
AUTHENTICATED
```

Return current user.

---

# 11. Product APIs

## GET `/api/products`

Role:

```text
ADMIN
STAFF
```

Purpose:

Lấy toàn bộ sản phẩm đang active để build dropdown.

Query optional:

```text
?search=
```

Response:

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "clx...",
        "externalId": "SP001",
        "name": "Sản phẩm A",
        "volume": "30ml",
        "concentration": "10%",
        "price": 150000
      }
    ]
  }
}
```

Rule:

```text
isActive = true
```

---

## GET `/api/admin/products`

Role:

```text
ADMIN
```

Purpose:

Admin list tất cả product bao gồm inactive.

Query:

```text
?page=1
&pageSize=50
&search=
&status=ACTIVE|INACTIVE|ALL
```

Response có pagination.

---

## POST `/api/admin/products/sync`

Role:

```text
ADMIN
```

Purpose:

Sync thủ công Google Sheets → PostgreSQL.

Request:

```json
{}
```

Response:

```json
{
  "success": true,
  "data": {
    "syncLogId": "sync_xxx",
    "created": 3,
    "updated": 5,
    "unchanged": 48,
    "skipped": 0,
    "errors": 0,
    "completedAt": "2026-08-10T04:30:00.000Z"
  }
}
```

Error example:

```json
{
  "success": false,
  "error": {
    "code": "GOOGLE_SHEET_ACCESS_DENIED",
    "message": "Không thể đọc Google Sheet."
  }
}
```

---

## GET `/api/admin/products/sync-logs`

Role:

```text
ADMIN
```

Query:

```text
?page=1
&pageSize=20
```

Return lịch sử sync.

---

## POST `/api/admin/products/import-excel`

Role:

```text
ADMIN
```

Purpose:

Fallback import.

Request:

```text
multipart/form-data
```

Field:

```text
file
```

Allowed:

```text
.xlsx
```

Process giống Google Sheet sync.

---

# 12. Invoice APIs

## POST `/api/invoices`

Role:

```text
ADMIN
STAFF
```

Purpose:

Tạo hóa đơn.

Request:

```json
{
  "customerName": "Nguyễn Văn A",
  "phone": "0901234567",
  "address": "123 Nguyễn Trãi, Hà Nội",
  "items": [
    {
      "productId": "clx_product_1",
      "quantity": 2
    },
    {
      "productId": "clx_product_2",
      "quantity": 1
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
    "email": "invoice@example.com"
  }
}
```

Backend không nhận `unitPrice` làm source of truth.

---

## 12.1. Server create invoice flow

```text
Validate request
    ↓
Load tất cả productId
    ↓
Check product active
    ↓
Resolve giá từ DB
    ↓
Tính lineTotal
    ↓
Tính subtotal
    ↓
Normalize shippingFee
    ↓
Tính total
    ↓
Generate invoiceNumber
    ↓
Prisma transaction
    ↓
Create Invoice
    ↓
Create InvoiceItems snapshot
    ↓
Return invoice
```

Pseudo:

```ts
const productIds = input.items.map(item => item.productId)

const products = await prisma.product.findMany({
  where: {
    id: {
      in: productIds
    },
    isActive: true
  }
})

if (products.length !== new Set(productIds).size) {
  throw new ProductUnavailableError()
}

const normalizedItems = input.items.map(item => {
  const product = productMap.get(item.productId)!

  const unitPrice = product.price
  const lineTotal = unitPrice.mul(item.quantity)

  return {
    productId: product.id,
    productName: product.name,
    volume: product.volume,
    concentration: product.concentration,
    unitPrice,
    quantity: item.quantity,
    lineTotal
  }
})
```

---

## 12.2. Shipping rule

Nếu:

```text
shippingMethod = FREE
```

backend:

```text
shippingFee = 0
```

Nếu:

```text
DELIVERY_APP
COURIER
```

thì:

```text
shippingFee >= 0
```

---

## 12.3. Issue invoice validation

Nếu:

```text
issueInvoice = true
```

bắt buộc:

```text
companyName
invoiceAddress
invoiceEmail
```

Nếu false:

backend normalize:

```text
companyName = null
invoiceAddress = null
invoiceEmail = null
```

---

## 12.4. Invoice transaction

```ts
const invoice = await prisma.$transaction(async tx => {
  const createdInvoice = await tx.invoice.create({
    data: {
      // ...
    }
  })

  await tx.invoiceItem.createMany({
    data: normalizedItems.map(item => ({
      invoiceId: createdInvoice.id,
      ...item
    }))
  })

  return tx.invoice.findUnique({
    where: {
      id: createdInvoice.id
    },
    include: {
      items: true,
      createdBy: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
})
```

---

## GET `/api/invoices`

Role:

```text
ADMIN
STAFF
```

Purpose:

Danh sách hóa đơn.

Query:

```text
?page=1
&pageSize=20
&search=
&paymentMethod=
&shippingMethod=
&status=
&dateFrom=
&dateTo=
```

`search` tìm:

- invoiceNumber
- customerName
- phone

Sort mặc định:

```text
createdAt DESC
```

---

## GET `/api/invoices/:id`

Role:

```text
ADMIN
STAFF
```

Purpose:

Chi tiết hóa đơn.

Response:

```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "...",
      "invoiceNumber": "HD-20260810-0001",
      "customerName": "Nguyễn Văn A",
      "phone": "0901234567",
      "address": "Hà Nội",
      "paymentMethod": "BANK_TRANSFER",
      "shippingMethod": "DELIVERY_APP",
      "shippingFee": 50000,
      "subtotal": 550000,
      "total": 600000,
      "note": "Giao sau 18h",
      "issueInvoice": true,
      "companyName": "ABC Company",
      "invoiceAddress": "Hà Nội",
      "invoiceEmail": "invoice@example.com",
      "status": "CONFIRMED",
      "createdAt": "...",
      "items": []
    }
  }
}
```

---

## PATCH `/api/invoices/:id/status`

Role:

```text
ADMIN
```

MVP chỉ cho:

```text
CONFIRMED
CANCELLED
```

Request:

```json
{
  "status": "CANCELLED"
}
```

Không delete invoice.

Không sửa giá invoice cũ.

---

# 13. API không cần cho MVP

Chưa cần:

```text
PUT /api/invoices/:id
DELETE /api/invoices/:id
PATCH /api/products/:id
DELETE /api/products/:id
```

Lý do:

- Product source of truth là Google Sheet.
- Invoice lịch sử không nên sửa tùy ý.
- Cancel invoice thay vì delete.

---

# 14. Error code chuẩn

Đề xuất enum application error:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND

INVALID_CREDENTIALS
USER_DISABLED

PRODUCT_NOT_FOUND
PRODUCT_INACTIVE
PRODUCT_VARIANT_INVALID

INVOICE_NOT_FOUND
INVOICE_ALREADY_CANCELLED

GOOGLE_SHEET_ACCESS_DENIED
GOOGLE_SHEET_INVALID_FORMAT
GOOGLE_SHEET_DUPLICATE_ID
GOOGLE_SHEET_SYNC_FAILED

EXCEL_INVALID_FILE
EXCEL_INVALID_FORMAT

INTERNAL_SERVER_ERROR
```

---

# 15. HTTP status mapping

| Error | HTTP |
|---|---:|
| VALIDATION_ERROR | 400 |
| UNAUTHORIZED | 401 |
| INVALID_CREDENTIALS | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| PRODUCT_NOT_FOUND | 404 |
| INVOICE_NOT_FOUND | 404 |
| PRODUCT_INACTIVE | 409 |
| INVOICE_ALREADY_CANCELLED | 409 |
| GOOGLE_SHEET_INVALID_FORMAT | 422 |
| INTERNAL_SERVER_ERROR | 500 |

---

# 16. Invoice Number Strategy

Format:

```text
HD-YYYYMMDD-NNNN
```

Ví dụ:

```text
HD-20260810-0001
HD-20260810-0002
```

Không generate chỉ bằng:

```text
count + 1
```

vì có race condition.

MVP có thể dùng một trong hai phương án:

### Phương án A — DB sequence riêng

Khuyến nghị nếu cần format tăng tuần tự chắc chắn.

### Phương án B — ID timestamp/random nội bộ

Ví dụ:

```text
HD-20260810-A7K3
```

Đơn giản hơn và tránh collision.

Nếu bắt buộc `0001`, dev phải implement transaction/sequence an toàn.

---

# 17. Zod validation schema đề xuất

## Create Invoice

```ts
const createInvoiceSchema = z.object({
  customerName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  address: z.string().trim().min(1),

  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1)
    })
  ).min(1),

  paymentMethod: z.enum([
    "BANK_TRANSFER",
    "COD"
  ]),

  shippingMethod: z.enum([
    "FREE",
    "DELIVERY_APP",
    "COURIER"
  ]),

  shippingFee: z.number().min(0).default(0),

  note: z.string().trim().optional(),

  issueInvoice: z.boolean().default(false),

  invoiceInfo: z.object({
    companyName: z.string().trim(),
    address: z.string().trim(),
    email: z.string().email()
  }).optional()
}).superRefine((data, ctx) => {
  if (data.issueInvoice && !data.invoiceInfo) {
    ctx.addIssue({
      code: "custom",
      path: ["invoiceInfo"],
      message: "Thông tin xuất hóa đơn là bắt buộc."
    })
  }

  if (
    data.shippingMethod !== "FREE" &&
    data.shippingFee < 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["shippingFee"],
      message: "Phí ship không hợp lệ."
    })
  }
})
```

---

# 18. Backend folder structure

```text
src/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── me/route.ts
│       │
│       ├── products/
│       │   └── route.ts
│       │
│       ├── invoices/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── route.ts
│       │       └── status/
│       │           └── route.ts
│       │
│       └── admin/
│           └── products/
│               ├── route.ts
│               ├── sync/
│               │   └── route.ts
│               ├── sync-logs/
│               │   └── route.ts
│               └── import-excel/
│                   └── route.ts
│
├── server/
│   ├── auth/
│   ├── services/
│   │   ├── invoice.service.ts
│   │   ├── product.service.ts
│   │   ├── product-sync.service.ts
│   │   └── excel-import.service.ts
│   │
│   ├── repositories/
│   │   ├── invoice.repository.ts
│   │   └── product.repository.ts
│   │
│   ├── validators/
│   │   ├── invoice.schema.ts
│   │   └── product-sync.schema.ts
│   │
│   └── errors/
│       └── app-error.ts
│
└── lib/
    ├── prisma.ts
    ├── google-sheets.ts
    └── money.ts
```

---

# 19. Frontend page structure

```text
src/app/
├── login/
│   └── page.tsx
│
├── invoices/
│   ├── page.tsx
│   ├── create/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
│
└── admin/
    └── products/
        └── page.tsx
```

---

# 20. Frontend component structure

```text
src/components/
├── invoice/
│   ├── InvoiceForm.tsx
│   ├── CustomerFields.tsx
│   ├── ProductItemsField.tsx
│   ├── InvoiceItemRow.tsx
│   ├── ShippingFields.tsx
│   ├── PaymentFields.tsx
│   ├── InvoiceCompanyFields.tsx
│   ├── InvoicePreview.tsx
│   └── InvoiceActions.tsx
│
├── product/
│   ├── ProductNameSelect.tsx
│   ├── VolumeSelect.tsx
│   └── ConcentrationSelect.tsx
│
└── admin/
    ├── ProductTable.tsx
    ├── ProductSyncCard.tsx
    ├── ProductSyncResult.tsx
    └── SyncLogTable.tsx
```

---

# 21. Frontend invoice form state

Đề xuất:

```ts
type InvoiceFormValues = {
  customerName: string
  phone: string
  address: string

  items: {
    productId: string
    quantity: number
  }[]

  paymentMethod:
    | "BANK_TRANSFER"
    | "COD"

  shippingMethod:
    | "FREE"
    | "DELIVERY_APP"
    | "COURIER"

  shippingFee: number

  note?: string

  issueInvoice: boolean

  invoiceInfo?: {
    companyName: string
    address: string
    email: string
  }
}
```

Frontend không cần submit:

```text
productName
price
volume
concentration
lineTotal
subtotal
total
```

Backend sẽ resolve lại.

---

# 22. Dependent dropdown implementation

API trả toàn bộ variant active.

Ví dụ:

```ts
type ProductVariant = {
  id: string
  name: string
  volume: string
  concentration: string
  price: number
}
```

## Step 1 — Product names

```ts
const productNames = unique(
  products.map(p => p.name)
)
```

## Step 2 — Volume

```ts
const volumes = unique(
  products
    .filter(p => p.name === selectedName)
    .map(p => p.volume)
)
```

## Step 3 — Concentration

```ts
const concentrations = unique(
  products
    .filter(
      p =>
        p.name === selectedName &&
        p.volume === selectedVolume
    )
    .map(p => p.concentration)
)
```

## Step 4 — Resolve variant

```ts
const variant = products.find(
  p =>
    p.name === selectedName &&
    p.volume === selectedVolume &&
    p.concentration === selectedConcentration
)
```

Sau cùng set:

```text
productId = variant.id
```

---

# 23. Frontend preview calculation

Frontend tính chỉ để preview:

```ts
lineTotal = unitPrice * quantity
subtotal = sum(lineTotal)
total = subtotal + shippingFee
```

Nhưng khi submit:

```text
Backend tính lại toàn bộ.
```

Sau khi API trả invoice thành công:

```text
Preview cuối phải dùng invoice từ backend response.
```

---

# 24. Invoice Preview requirements

Component:

```tsx
<InvoicePreview invoice={invoice} />
```

Dùng cho:

- Preview realtime.
- Invoice detail.
- PNG.
- PDF.
- Print trong tương lai.

Không viết 4 layout khác nhau.

---

# 25. Copy Invoice

Function:

```text
buildInvoicePlainText(invoice)
```

Output:

```text
Khách hàng: Nguyễn Văn A
SĐT: 0901234567
Địa chỉ: Hà Nội

2 × Product A - 30ml - 10%
150.000đ × 2 = 300.000đ

--------------------
Tiền hàng: 300.000đ
Thanh toán: Chuyển khoản
Giao hàng: App giao hàng
Phí ship: 50.000đ
--------------------
TỔNG CỘNG: 350.000đ
```

Clipboard:

```ts
navigator.clipboard.writeText(text)
```

---

# 26. Export PNG

Library:

```text
html-to-image
```

Source:

```text
InvoicePreview DOM node
```

Requirements:

- Background trắng.
- Không có button.
- Pixel ratio >= 2.
- Font render đúng tiếng Việt.
- File name sanitized.

Ví dụ:

```text
hoa-don-nguyen-van-a-2026-08-10.png
```

---

# 27. Export PDF

MVP:

```text
InvoicePreview
    ↓
html-to-image / canvas
    ↓
jsPDF
    ↓
A4 PDF
```

Requirements:

- Portrait.
- Multi-page nếu dài.
- Không cắt item giữa dòng nếu có thể.
- Filename:

```text
hoa-don-nguyen-van-a-2026-08-10.pdf
```

---

# 28. Backend Task Checklist

## BE-01 — Project foundation

- [ ] Setup Next.js TypeScript.
- [ ] Setup PostgreSQL.
- [ ] Install Prisma ORM.
- [ ] Tạo `schema.prisma`.
- [ ] Tạo migration init.
- [ ] Tạo Prisma singleton.
- [ ] Setup env validation.
- [ ] Setup lint / typecheck.
- [ ] Setup error response standard.

**Done khi:**

- App connect được database.
- Prisma Client hoạt động.
- Migration production-ready.

---

## BE-02 — Authentication

- [ ] Tạo User model.
- [ ] Seed ADMIN.
- [ ] Hash password.
- [ ] Login endpoint.
- [ ] Logout endpoint.
- [ ] `/api/auth/me`.
- [ ] Middleware/session validation.
- [ ] Role guard ADMIN / STAFF.
- [ ] Disable inactive user.

**Done khi:**

- Staff không gọi được admin API.
- Anonymous không gọi invoice API.

---

## BE-03 — Product model & repository

- [ ] Product CRUD nội bộ repository.
- [ ] `GET /api/products`.
- [ ] Active-only query.
- [ ] Search admin product.
- [ ] Pagination admin list.
- [ ] Index database.

---

## BE-04 — Google Sheets integration

- [ ] Google Service Account.
- [ ] Environment credentials.
- [ ] Sheets client.
- [ ] Read Products sheet.
- [ ] Normalize header.
- [ ] Parse price.
- [ ] Parse active boolean.
- [ ] Handle permission error.
- [ ] Handle missing sheet.
- [ ] Handle empty sheet.

---

## BE-05 — Product sync service

- [ ] Row validation.
- [ ] Detect duplicate external ID.
- [ ] Upsert product.
- [ ] Count created.
- [ ] Count updated.
- [ ] Count unchanged.
- [ ] Count skipped.
- [ ] Log errors.
- [ ] Save ProductSyncLog.
- [ ] `POST /api/admin/products/sync`.
- [ ] `GET /api/admin/products/sync-logs`.

---

## BE-06 — Excel import fallback

- [ ] Accept `.xlsx`.
- [ ] Limit file size.
- [ ] Parse workbook.
- [ ] Map columns giống Google Sheet.
- [ ] Reuse product sync validator.
- [ ] Reuse upsert service.
- [ ] Save sync source = EXCEL.
- [ ] Return summary.

---

## BE-07 — Invoice validation

- [ ] Create invoice Zod schema.
- [ ] Quantity integer >= 1.
- [ ] At least 1 item.
- [ ] Valid payment method.
- [ ] Valid shipping method.
- [ ] Shipping fee >= 0.
- [ ] Issue invoice conditional fields.
- [ ] Email validation.

---

## BE-08 — Invoice calculation service

- [ ] Query all product IDs.
- [ ] Reject missing product.
- [ ] Reject inactive product.
- [ ] Ignore frontend price.
- [ ] Calculate unit price from DB.
- [ ] Calculate line total.
- [ ] Calculate subtotal.
- [ ] Normalize free shipping.
- [ ] Calculate total.
- [ ] Unit tests for money calculation.

---

## BE-09 — Invoice creation

- [ ] Generate invoice number.
- [ ] Use Prisma transaction.
- [ ] Create Invoice.
- [ ] Create InvoiceItems.
- [ ] Snapshot product fields.
- [ ] Store createdBy.
- [ ] Return complete invoice.
- [ ] Prevent partial save.

---

## BE-10 — Invoice list/detail

- [ ] `GET /api/invoices`.
- [ ] Pagination.
- [ ] Search invoice number.
- [ ] Search customer name.
- [ ] Search phone.
- [ ] Filter payment method.
- [ ] Filter shipping method.
- [ ] Filter date.
- [ ] `GET /api/invoices/:id`.

---

## BE-11 — Invoice status

- [ ] `PATCH /api/invoices/:id/status`.
- [ ] ADMIN only.
- [ ] CONFIRMED → CANCELLED.
- [ ] Không delete invoice.
- [ ] Không sửa snapshot item.

---

## BE-12 — Backend testing

- [ ] Product sync tests.
- [ ] Invoice calculation tests.
- [ ] Invoice snapshot price test.
- [ ] Permission tests.
- [ ] Validation tests.
- [ ] Transaction rollback test.
- [ ] Free ship test.
- [ ] Paid ship test.

---

# 29. Frontend Task Checklist

## FE-01 — App shell

- [ ] Login page.
- [ ] Protected layout.
- [ ] Sidebar/header.
- [ ] Responsive navigation.
- [ ] User menu/logout.

---

## FE-02 — Invoice create page

- [ ] Route `/invoices/create`.
- [ ] Load products.
- [ ] Loading state.
- [ ] Error state.
- [ ] Form layout desktop.
- [ ] Form layout mobile.

---

## FE-03 — Customer fields

- [ ] Customer name.
- [ ] Phone.
- [ ] Address.
- [ ] Client validation.
- [ ] Field error text.

---

## FE-04 — Product item field array

- [ ] React Hook Form `useFieldArray`.
- [ ] Add item.
- [ ] Remove item.
- [ ] Minimum 1 item.
- [ ] Quantity minus.
- [ ] Quantity plus.
- [ ] Quantity min = 1.

---

## FE-05 — Dependent product dropdown

- [ ] Product name select.
- [ ] Volume select.
- [ ] Concentration select.
- [ ] Filter valid options.
- [ ] Reset dependent value khi parent đổi.
- [ ] Resolve exact productId.
- [ ] Show unit price.
- [ ] Prevent invalid combination.

---

## FE-06 — Payment fields

- [ ] Chuyển khoản.
- [ ] COD.
- [ ] Default hợp lý.

---

## FE-07 — Shipping fields

- [ ] Free ship.
- [ ] App giao hàng.
- [ ] Cước xe.
- [ ] Conditional shipping fee input.
- [ ] Reset shippingFee = 0 khi Free Ship.
- [ ] VND number input.

---

## FE-08 — Note & invoice company fields

- [ ] Note textarea.
- [ ] Issue invoice radio.
- [ ] Default = Không.
- [ ] Conditional company fields.
- [ ] Company name required.
- [ ] Invoice address required.
- [ ] Invoice email required.
- [ ] Email validation.

---

## FE-09 — Realtime calculation

- [ ] Line total.
- [ ] Subtotal.
- [ ] Shipping fee.
- [ ] Grand total.
- [ ] VND formatter.
- [ ] Free ship hides fee row.

---

## FE-10 — InvoicePreview

- [ ] Reusable component.
- [ ] Customer info.
- [ ] Address.
- [ ] Product item list.
- [ ] Unit price × quantity.
- [ ] Line total.
- [ ] Subtotal.
- [ ] Payment method.
- [ ] Shipping method.
- [ ] Conditional shipping fee.
- [ ] Grand total.
- [ ] Conditional note.
- [ ] Conditional invoice company info.
- [ ] Responsive.
- [ ] Print/export-safe styling.

---

## FE-11 — Submit invoice

- [ ] Submit only productId + quantity.
- [ ] Loading state.
- [ ] Disable double submit.
- [ ] API error mapping.
- [ ] Success state.
- [ ] Replace preview bằng backend response sau success.

---

## FE-12 — Copy

- [ ] Build plain text.
- [ ] Clipboard.
- [ ] Success toast.
- [ ] Fallback error message.
- [ ] Vietnamese text test.

---

## FE-13 — PNG

- [ ] Capture InvoicePreview.
- [ ] White background.
- [ ] High DPI.
- [ ] Correct filename.
- [ ] No action buttons in image.
- [ ] Long invoice test.

---

## FE-14 — PDF

- [ ] A4 portrait.
- [ ] Multi-page.
- [ ] Correct filename.
- [ ] Vietnamese font render.
- [ ] Long invoice test.
- [ ] Multiple items test.

---

## FE-15 — Invoice list

- [ ] Route `/invoices`.
- [ ] Table.
- [ ] Pagination.
- [ ] Search.
- [ ] Filter.
- [ ] Loading skeleton.
- [ ] Empty state.
- [ ] Open detail.

---

## FE-16 — Invoice detail

- [ ] Route `/invoices/[id]`.
- [ ] Reuse InvoicePreview.
- [ ] Copy.
- [ ] PNG.
- [ ] PDF.
- [ ] Show status.
- [ ] Admin cancel action.

---

# 30. Admin Task Checklist

## AD-01 — Product admin page

- [ ] Route `/admin/products`.
- [ ] ADMIN guard.
- [ ] Product count.
- [ ] Last sync time.
- [ ] Product table.
- [ ] Search.
- [ ] Active/inactive filter.
- [ ] Pagination.

---

## AD-02 — Google Sheet sync UI

- [ ] Sync button.
- [ ] Disable button while syncing.
- [ ] Loading indicator.
- [ ] Success summary.
- [ ] Created count.
- [ ] Updated count.
- [ ] Unchanged count.
- [ ] Skipped count.
- [ ] Error count.
- [ ] Error details.
- [ ] Refresh product table after success.

---

## AD-03 — Sync logs

- [ ] List latest sync logs.
- [ ] Source badge.
- [ ] Status badge.
- [ ] Started/completed time.
- [ ] Counts.
- [ ] Expand error detail.

---

## AD-04 — Excel fallback

- [ ] Upload button.
- [ ] Accept `.xlsx`.
- [ ] File validation.
- [ ] Upload progress/loading.
- [ ] Import summary.
- [ ] Error details.

---

## AD-05 — User permissions

Nếu MVP có user management:

- [ ] List user.
- [ ] Create STAFF.
- [ ] Set role.
- [ ] Disable user.
- [ ] Không cho tự xóa admin cuối cùng.

Nếu chưa cần UI user management:

```text
Có thể seed/admin DB thủ công ở MVP.
```

---

# 31. Cross-team Task Checklist

## Architecture

- [ ] Google Sheets không được gọi từ frontend.
- [ ] Không cron sync.
- [ ] Database là runtime source of truth.
- [ ] Product sync không sửa invoice cũ.
- [ ] Invoice creation dùng transaction.
- [ ] Backend tính lại giá và total.

---

## Security

- [ ] HTTPS production.
- [ ] Google credentials chỉ server-side.
- [ ] DATABASE_URL chỉ server-side.
- [ ] Password hash.
- [ ] Session secure.
- [ ] Role guard server-side.
- [ ] Upload file size limit.
- [ ] No stack trace cho client.
- [ ] Validate tất cả request.

---

## UX

- [ ] Desktop 2 cột.
- [ ] Mobile stack.
- [ ] Preview sticky desktop.
- [ ] Không mất form khi validation error.
- [ ] Có loading state.
- [ ] Có empty state.
- [ ] Có success/error toast.

---

# 32. Recommended Sprint Breakdown

## Sprint 1 — Foundation

Scope:

- Database.
- Prisma.
- Authentication.
- Product model.
- Base UI.

Tasks:

```text
BE-01
BE-02
BE-03
FE-01
```

---

## Sprint 2 — Product data

Scope:

- Google Sheets sync.
- Admin products.
- Excel fallback.

Tasks:

```text
BE-04
BE-05
BE-06
AD-01
AD-02
AD-03
AD-04
```

---

## Sprint 3 — Invoice core

Scope:

- Invoice form.
- Product variants.
- Calculation.
- Save invoice.

Tasks:

```text
BE-07
BE-08
BE-09
FE-02
FE-03
FE-04
FE-05
FE-06
FE-07
FE-08
FE-09
FE-11
```

---

## Sprint 4 — Output

Scope:

- Preview.
- Copy.
- PNG.
- PDF.

Tasks:

```text
FE-10
FE-12
FE-13
FE-14
```

---

## Sprint 5 — History & hardening

Scope:

- Invoice list.
- Detail.
- Cancel.
- Tests.
- QA.

Tasks:

```text
BE-10
BE-11
BE-12
FE-15
FE-16
```

---

# 33. Acceptance Criteria theo module

## Product Sync

- [ ] Admin sync được Google Sheet bằng một nút.
- [ ] Product mới được insert.
- [ ] Product thay đổi được update.
- [ ] Product `active=false` trở thành inactive.
- [ ] Duplicate ID được báo.
- [ ] Invalid row không làm crash cả app.
- [ ] Có sync log.
- [ ] Không cần realtime sync.

---

## Invoice Creation

- [ ] Tạo được 1 item.
- [ ] Tạo được nhiều item.
- [ ] Chỉ chọn được variant hợp lệ.
- [ ] Quantity >= 1.
- [ ] Backend lấy giá từ DB.
- [ ] Backend tính lại subtotal/total.
- [ ] Free ship = 0.
- [ ] Paid shipping cộng đúng.
- [ ] Issue invoice validation hoạt động.
- [ ] Tạo trong transaction.
- [ ] Snapshot product data chính xác.

---

## Historical Integrity

Test bắt buộc:

```text
1. Product price = 150000
2. Create Invoice A
3. Change Sheet price = 180000
4. Sync
5. Open Invoice A
```

Expected:

```text
Invoice A unitPrice = 150000
```

New invoice:

```text
unitPrice = 180000
```

---

## Export

- [ ] Copy hoạt động.
- [ ] PNG hoạt động.
- [ ] PDF hoạt động.
- [ ] Tiếng Việt đúng.
- [ ] Không export buttons.
- [ ] Long invoice không vỡ layout.
- [ ] Invoice detail export giống create success preview.

---

# 34. Definition of Done toàn dự án

Dự án chỉ được coi là hoàn thành khi:

- [ ] `prisma migrate deploy` chạy thành công.
- [ ] Production database indexes đầy đủ.
- [ ] Không có TypeScript error.
- [ ] Không có ESLint blocker.
- [ ] Không có console error trong main flow.
- [ ] Authentication hoạt động.
- [ ] Role permissions hoạt động.
- [ ] Google Sheet sync hoạt động.
- [ ] Excel fallback hoạt động.
- [ ] Create invoice hoạt động.
- [ ] Backend calculation đúng.
- [ ] Snapshot price đúng.
- [ ] Invoice list hoạt động.
- [ ] Invoice detail hoạt động.
- [ ] Copy hoạt động.
- [ ] PNG hoạt động.
- [ ] PDF hoạt động.
- [ ] Desktop responsive.
- [ ] Mobile usable.
- [ ] Error state rõ ràng.
- [ ] Loading state đầy đủ.
- [ ] QA historical price pass.

---

# 35. API Endpoint Summary

| Method | Endpoint | Role | Mục đích |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/auth/me` | Auth | Current user |
| GET | `/api/products` | Admin/Staff | Active product variants |
| GET | `/api/admin/products` | Admin | Product admin list |
| POST | `/api/admin/products/sync` | Admin | Sync Google Sheets |
| GET | `/api/admin/products/sync-logs` | Admin | Sync history |
| POST | `/api/admin/products/import-excel` | Admin | Excel fallback |
| POST | `/api/invoices` | Admin/Staff | Create invoice |
| GET | `/api/invoices` | Admin/Staff | Invoice list |
| GET | `/api/invoices/:id` | Admin/Staff | Invoice detail |
| PATCH | `/api/invoices/:id/status` | Admin | Cancel/status invoice |

---

# 36. Routes UI Summary

| Route | Role | Screen |
|---|---|---|
| `/login` | Public | Login |
| `/invoices/create` | Admin/Staff | Tạo hóa đơn |
| `/invoices` | Admin/Staff | Lịch sử hóa đơn |
| `/invoices/[id]` | Admin/Staff | Chi tiết hóa đơn |
| `/admin/products` | Admin | Product + Sync |

---

# 37. Biến môi trường

```env
DATABASE_URL=

AUTH_SECRET=

GOOGLE_PROJECT_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=

GOOGLE_SHEET_ID=
GOOGLE_SHEET_NAME=Products

ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Production:

- Không commit `.env`.
- Ưu tiên Secret Manager của hosting provider.
- `GOOGLE_PRIVATE_KEY` cần normalize newline đúng khi load.

---

# 38. Quy tắc implementation cuối cùng

## Không được làm

```text
Frontend → Google Sheets trực tiếp
```

```text
Frontend quyết định giá cuối cùng
```

```text
Invoice đọc lại giá từ Product khi xem lịch sử
```

```text
Delete invoice
```

```text
Delete product chỉ vì row biến mất khỏi Sheet
```

```text
Cron sync không cần thiết
```

---

## Phải làm

```text
Google Sheets
    ↓
Manual Sync
    ↓
Product DB
```

```text
Frontend gửi productId + quantity
    ↓
Backend resolve giá
    ↓
Backend tính tiền
    ↓
Snapshot InvoiceItem
```

```text
InvoicePreview
    ↓
Reuse cho Detail / PNG / PDF
```

---

# 39. Mốc bàn giao dev đề xuất

Dev nên bàn giao theo thứ tự:

```text
Milestone 1
Auth + Database + Product API

Milestone 2
Google Sheet Sync + Admin Product

Milestone 3
Invoice Create + Calculation + Save

Milestone 4
Preview + Copy + PNG + PDF

Milestone 5
History + Detail + Cancel + QA
```

Không nên làm export PNG/PDF trước khi data model và `InvoicePreview` ổn định.

---

# 40. Kết luận

Kiến trúc production MVP:

```text
Google Sheets
      │
      │ Manual Admin Sync
      ▼
PostgreSQL + Prisma
      │
      ▼
Next.js Route Handlers
      │
      ├── Product API
      ├── Invoice API
      └── Admin API
      │
      ▼
Next.js UI
      │
      ├── Create Invoice
      ├── Realtime Preview
      ├── Invoice History
      ├── Copy
      ├── PNG
      └── PDF
```

Nguyên tắc cốt lõi:

> Product Database chứa giá hiện tại. InvoiceItem chứa giá lịch sử tại thời điểm bán.

Đây là ranh giới dữ liệu quan trọng nhất của toàn bộ hệ thống.
