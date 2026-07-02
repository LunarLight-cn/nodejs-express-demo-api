# Crypto C2C Exchange — Backend Exam

A peer-to-peer (C2C) cryptocurrency exchange REST API built with Node.js, Express, Sequelize, and SQLite.

Users can buy and sell cryptocurrencies (BTC, ETH, XRP, DOGE) using fiat currencies (THB, USD) by creating orders and matching with other users in the system.

## Tech Stack

| Component | Technology          |
| --------- | ------------------- |
| Runtime   | Node.js             |
| Framework | Express 5           |
| ORM       | Sequelize 6         |
| Database  | SQLite 3            |
| Auth      | JWT + bcrypt        |
| API Docs  | Swagger (OpenAPI 3) |

## ER Diagram
Please refer to the [ERDiagram documentation](./ERDiagram/ERD.md) for the database structure, which includes:
- The visual ER Diagram image
- The DBML code for dbdiagram.io (for better visualization)
- The Mermaid ER Diagram code

## Setup & Run

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/LunarLight-cn/CryptoBackendExam.git
cd CryptoBackendExam

# 2. Install dependencies
npm install

# 3. Create a .env file
#    (You can simply rename or copy .env.example to .env)
cp .env.example .env

# 4. Seed the database with test data
npm run seed

# 5. Start the server
npm start
```

The server will be running at **http://localhost:PORT**.

### API Documentation (Swagger)

Open **http://localhost:PORT** in your browser to explore the interactive Swagger API docs.

## API Endpoints

### Auth

| Method | Endpoint        | Auth | Description               |
| ------ | --------------- | ---- | ------------------------- |
| POST   | `/api/register` | No   | Register a new user       |
| POST   | `/api/login`    | No   | Login and get a JWT token |

### Orders (C2C)

| Method | Endpoint            | Auth | Description                    |
| ------ | ------------------- | ---- | ------------------------------ |
| GET    | `/api/getAllOrders` | No   | List all orders (with filters) |
| POST   | `/api/createOrder`  | Yes  | Create a new buy/sell order    |

### Trades

| Method | Endpoint                | Auth | Description                                  |
| ------ | ----------------------- | ---- | -------------------------------------------- |
| POST   | `/api/orders/:id/trade` | Yes  | Accept an order and complete trade instantly |
| GET    | `/api/getUserTrades`    | Yes  | Get your trade history                       |

### Wallets

| Method | Endpoint                  | Auth | Description                        |
| ------ | ------------------------- | ---- | ---------------------------------- |
| GET    | `/api/getMyWallets`       | Yes  | View your wallet balances          |
| POST   | `/api/transfer`           | Yes  | Transfer coins (internal/external) |
| GET    | `/api/getTransferHistory` | Yes  | View your transfer history         |

## Trading Flow

```
1. Register  →  POST /api/register
2. Login     →  POST /api/login  (get JWT token)
3. Seller creates a sell order    →  POST /api/createOrder
4. Buyer accepts and completes    →  POST /api/orders/:id/trade
   → Crypto is transferred to buyer, fiat to seller instantly
```

## Test Accounts (after seeding)

| Username | Email            | Password    |
| -------- | ---------------- | ----------- |
| jane     | jane@example.com | password123 |
| john     | john@example.com | password123 |
| alex     | alex@example.com | password123 |

## API Testing Walkthrough (Swagger)

You can use the following step-by-step scenario to test the API via Swagger UI (`http://localhost:3000`).

### Phase 1: Authentication

**1. Login as Jane**

- **API**: `POST /api/login`
- **Body**:
  ```json
  { "email": "jane@example.com", "password": "password123" }
  ```
- **Action**: Copy the `token` from the response. Click the **Authorize** button (🔓) at the top right of the Swagger page, paste the token, and click Save (🔒).

### Phase 2: Wallets & Transfers

**2. Check Balances**

- **API**: `GET /api/getMyWallets`
- **Result**: You should see Jane's balances (e.g., 500000 THB, 5000 USD).

**3. Internal Transfer (Send to a friend)**

- **API**: `POST /api/transfer`
- **Body**:
  ```json
  {
    "to_username": "john",
    "recipient_address": "",
    "crc_id": 1,
    "amount": 5000
  }
  ```
- **Result**: Jane's THB balance is deducted by 5000, and transferred to John.

**4. External Transfer (Withdrawal)**

- **API**: `POST /api/transfer`
- **Body**:
  ```json
  {
    "to_username": "",
    "recipient_address": "0xABCDEF123456789",
    "crc_id": 3,
    "amount": 0.1
  }
  ```
- **Result**: 0.1 BTC is withdrawn to the external address.

### Phase 3: C2C Trading

**5. Create a Sell Order**

- **API**: `POST /api/createOrder`
- **Scenario**: Jane wants to sell 0.5 BTC at 1,500,000 THB/BTC.
- **Body**:
  ```json
  {
    "type": "sell",
    "base_crc_id": 3,
    "quote_crc_id": 1,
    "price": 150000,
    "amount": 0.5
  }
  ```
- **Result**: Order is created. 0.5 BTC is moved to `balance_lck` in Jane's wallet.

**6. View the Order**

- **API**: `GET /api/getAllOrders`
- **Parameters**: `type = sell`, `status = open`
- **Result**: Take note of the `id` of the order you just created (e.g., `id: 4`).

**7. Execute Trade (Matching)**

- **Action**: **Logout** from Swagger (🔓). Login again (`POST /api/login`) using John's credentials (`john@example.com` / `password123`). Authorize with John's token (🔒).
- **API**: `POST /api/orders/{id}/trade`
- **Parameters**: `id` = (the ID from step 6)
- **Body**:
  ```json
  { "amount": 0.5 }
  ```
- **Result**: Trade successful. 75,000 THB is deducted from John and sent to Jane. 0.5 BTC is unlocked and sent to John.

## Project Structure

```
CryptoBackendExam/
├── app.js                  # Express app entry point
├── config/
│   └── database.js         # Sequelize + SQLite configuration
├── controllers/
│   ├── AuthController.js   # Register & Login
│   ├── OrderController.js  # C2C order management
│   ├── TradeController.js  # Trade execution
│   └── WalletController.js # Wallet balance queries
├── ERDiagram/              # ER Diagram and Database Schema
│   ├── ERD.md              # Documentation with Mermaid diagram
│   ├── ERDiagram.png       # Visual diagram image
│   └── schema.dbml         # DBML code for dbdiagram.io (for better visualization)
├── middleware/
│   └── auth.js             # JWT verification middleware
├── models/
│   ├── index.js            # Model associations (relationships)
│   ├── User.js
│   ├── Currency.js
│   ├── Wallet.js
│   ├── Order.js
│   ├── Trade.js
│   └── Transfer.js
├── routes/
│   └── api.js              # API route definitions + Swagger docs
├── seeders/
│   └── seed.js             # Database seed script
├── .env                    # Environment variables
├── .gitignore
├── package.json
└── README.md
```
