ExpenseFlow - Personal Expense & Income Tracker

ExpenseFlow is a clean, simple, and premium personal finance dashboard built using Python (Flask) on the backend and HTML, CSS, and Vanilla JavaScript on the frontend. It uses a MySQL database to securely store users, incomes, and expenses.

Features
- Income & Expense Tracking: Log daily expenses and incomes with custom categories.
- Visual Analytics: Interactive donut charts showing category breakdown and weekly bar charts.
- AI Financial Advisor: Receives tips on how to increase income if it is low (deficit spending/below LKR 30k) and decrease outcome if it is high.
- Account Management: Register, log in, add new user accounts, and update your profile (name, email, password).
- Theme Customization: Sleek dark mode, clean light mode, or system-matching preference.
- Data Export: Export all ledger records as a CSV file.

Tech Stack
- Frontend: HTML5, CSS3 (variables, modern HSL color palettes), Vanilla JavaScript (ES6+, Lucide Icons).
- Backend: Python 3 (Flask, PyMySQL).
- Database: MySQL.

Setup Instructions

1. Prerequisites
Ensure you have the following installed:
- Python 3
- MySQL Server (running on `127.0.0.1:3306` with username `root` and an empty password).

2. Install Dependencies
Open your terminal and install the required Python packages:
```bash
pip install flask pymysql cryptography
```

3. Run the Application
Start the Flask development server:
```bash
python app.py
```

The database and tables will be created automatically on startup.

4. Test Credentials
To test the application immediately, open your browser to `http://127.0.0.1:5000` 
