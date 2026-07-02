# ER Diagram

This directory contains the database design for the Crypto C2C Exchange.

## 1. Visual Diagram

![ER Diagram Image](ERDiagram.png)
*(Note: Replace `ERDiagram.png` with the actual exported image from dbdiagram.io or your preferred tool)*

## 2. DBML Code for dbdiagram.io

You can copy and paste the contents of the `schema.dbml` file in this directory into [dbdiagram.io](https://dbdiagram.io) to generate or edit the visual diagram (for better visualization and interactivity).

## 3. Mermaid Diagram

You can also view the ER Diagram via Mermaid directly on GitHub:

```mermaid
erDiagram
    users ||--o{ wallets : "has many"
    users ||--o{ orders : "has many"
    users ||--o{ trades : "buys"
    users ||--o{ trades : "sells"
    users ||--o{ transfers : "sends"
    users |o--o{ transfers : "receives"
    currencies ||--o{ wallets : "has many"
    orders ||--o{ trades : "has many"
    currencies ||--o{ orders : "base currency"
    currencies ||--o{ orders : "quote currency"
    currencies ||--o{ trades : "base currency"
    currencies ||--o{ trades : "quote currency"
    currencies ||--o{ transfers : "currency"

    users {
        int id PK
        varchar username UK
        varchar email UK
        varchar pass_hash
        timestamp cdate
        timestamp udate
    }

    currencies {
        int id PK
        varchar code UK
        enum type "fiat, crypto"
        int decimal
        decimal min_withdraw
        boolean is_active
    }

    wallets {
        int id PK
        int owner_id FK
        int crc_id FK
        decimal balance
        decimal balance_lck
        timestamp cdate
        timestamp udate
    }

    orders {
        int id PK
        int user_id FK
        enum type "buy, sell"
        int base_crc_id FK
        int quote_crc_id FK
        decimal price
        decimal amount
        decimal remain_amount
        enum status "open, partial, completed, cancelled"
        timestamp cdate
        timestamp udate
    }

    trades {
        int id PK
        int order_id FK
        int buyer_id FK
        int seller_id FK
        int base_crc_id FK
        int quote_crc_id FK
        decimal price
        decimal base_amount
        decimal quote_amount
        enum status "pending_payment, paid, completed, cancelled"
        timestamp cdate
        timestamp udate
    }

    transfers {
        int id PK
        int sender_id FK
        int receiver_id FK
        int crc_id FK
        decimal amount
        varchar recipient_address
        enum type "internal, external"
        enum status "pending, completed, failed"
        timestamp cdate
    }
```
