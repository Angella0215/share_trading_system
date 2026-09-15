\# Web-Based Share Trading System — Stockbrokers Malawi Limited



A final-year project: a web-based platform for Stockbrokers Malawi Limited (SML), a stockbroking subsidiary of the National Bank of Malawi, enabling investors to open trading accounts, buy and sell shares in Malawi Stock Exchange (MSE) listed companies, and communicate with their broker — replacing the manual, email/paper-based process currently used.



\## Features



\- \*\*Investor\*\*: registration, KYC account opening with document uploads, browse MSE companies with live prices, buy/sell shares with real commission/VAT calculation, portfolio tracking, order history, deal notes, downloadable PDF statements, messaging with broker, Google sign-in, password reset

\- \*\*Broker\*\*: review and approve/reject investor KYC applications, dual-approval (maker-checker) order processing, messaging with investors

\- \*\*Admin\*\*: manage users, manage companies and daily share prices, order approval



\## Tech Stack



\- \*\*Frontend\*\*: HTML, CSS, JavaScript (vanilla, no framework)

\- \*\*Backend\*\*: Node.js, Express.js

\- \*\*Database\*\*: MySQL / MariaDB

\- \*\*Auth\*\*: JWT, bcrypt, Google OAuth

\- \*\*Other\*\*: multer (file uploads), pdfkit (PDF generation), nodemailer (email)



\## Prerequisites



Before you start, install:

\- \[XAMPP](https://www.apachefriends.org/) (for MySQL/MariaDB)

\- \[Node.js](https://nodejs.org/) (v18 or later recommended)

\- \[Git](https://git-scm.com/)

\- A code editor, e.g. \[VS Code](https://code.visualstudio.com/) with the \*\*Live Server\*\* extension



\## Setup Instructions



\### 1. Clone the repository



```bash

git clone https://github.com/Angella0215/share\_trading\_system.git

cd share\_trading\_system

```



\### 2. Set up the database



1\. Open XAMPP Control Panel and start \*\*MySQL\*\*

2\. Open phpMyAdmin (or a MySQL client) and create a database named `share\_trading\_system`

3\. Import the schema:

```bash

&#x20;  mysql -u root -p share\_trading\_system < database/database.sql

```

&#x20;  (Or import `database/database.sql` via phpMyAdmin's Import tab.)



\### 3. Set up the backend



```bash

cd backend

npm install

```



Create a `.env` file inside `backend/` with the following (fill in your own values):

