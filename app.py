import os
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, render_template, redirect, url_for, session, make_response
import pymysql
import pymysql.cursors
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='.', static_url_path='')
# A secret key is needed to keep client-side sessions secure
app.secret_key = 'expense_tracker_secret_key_12345'

# Database Configuration
DB_HOST = '127.0.0.1'
DB_USER = 'root'
DB_PASSWORD = ''
DB_NAME = 'expense_tracker'

def get_db_connection(create_db=False):
    """Establishes connection to MySQL. 
    If create_db is True, connects without specifying database to allow database creation."""
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=None if create_db else DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def init_db():
    """Initializes the database and creates required tables if they do not exist."""
    try:
        # Step 1: Create Database
        conn = get_db_connection(create_db=True)
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME}")
        conn.close()

        # Step 2: Create Tables
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Users Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    email VARCHAR(150) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    monthly_budget DECIMAL(15,2) DEFAULT 50000.00,
                    alert_enabled TINYINT(1) DEFAULT 1,
                    theme VARCHAR(20) DEFAULT 'system',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            # Expenses Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            # Incomes Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS incomes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    amount DECIMAL(15,2) NOT NULL,
                    date DATE NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
            
            # Seed a default user (Umar) if table is empty
            cursor.execute("SELECT COUNT(*) as count FROM users")
            if cursor.fetchone()['count'] == 0:
                hashed_pw = generate_password_hash('password123')
                cursor.execute(
                    "INSERT INTO users (id, username, email, password, monthly_budget, alert_enabled, theme) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (1, 'Umar', 'umar@example.com', hashed_pw, 100000.00, 1, 'system')
                )
                
                # Seed some transactions
                cursor.execute(
                    "INSERT INTO expenses (user_id, title, category, amount, date) VALUES (%s, %s, %s, %s, %s)",
                    (1, 'Groceries', 'Groceries', 1200.00, '2026-06-21')
                )
                cursor.execute(
                    "INSERT INTO expenses (user_id, title, category, amount, date) VALUES (%s, %s, %s, %s, %s)",
                    (1, 'Bought a laptop', 'Other', 65000.00, '2026-06-21')
                )
                cursor.execute(
                    "INSERT INTO incomes (user_id, title, category, amount, date) VALUES (%s, %s, %s, %s, %s)",
                    (1, 'Monthly Salary', 'Salary', 150000.00, '2026-06-01')
                )
        conn.commit()
        conn.close()
        print("Database initialized successfully.")
    except Exception as e:
        print(f"Error during database initialization: {e}")

# Helper: Check if user is logged in
def is_logged_in():
    return 'user_id' in session

# --- ROUTE HANDLERS (VIEW RENDERING) ---

@app.route('/')
def index():
    if not is_logged_in():
        return redirect(url_for('login_page'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if is_logged_in():
        return redirect(url_for('index'))
        
    error = None
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        
        if email and password:
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
                    user = cursor.fetchone()
                conn.close()
                
                if user and check_password_hash(user['password'], password):
                    session['user_id'] = user['id']
                    session['username'] = user['username']
                    return redirect(url_for('index'))
                else:
                    error = "Invalid email or password."
            except Exception as e:
                error = f"Database error: {e}"
        else:
            error = "Please fill in all fields."
            
    return render_template('login.html', error=error)

@app.route('/signup', methods=['GET', 'POST'])
def signup_page():
    if is_logged_in():
        return redirect(url_for('index'))
        
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        
        if username and email and password:
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) as count FROM users WHERE email = %s", (email,))
                    if cursor.fetchone()['count'] > 0:
                        error = "Email is already registered."
                    else:
                        hashed_pw = generate_password_hash(password)
                        cursor.execute(
                            "INSERT INTO users (username, email, password, monthly_budget, alert_enabled, theme) VALUES (%s, %s, %s, %s, %s, %s)",
                            (username, email, hashed_pw, 50000.00, 1, 'system')
                        )
                        conn.commit()
                        
                        # Auto login
                        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
                        new_user = cursor.fetchone()
                        session['user_id'] = new_user['id']
                        session['username'] = username
                        conn.close()
                        return redirect(url_for('index'))
                if conn:
                    conn.close()
            except Exception as e:
                error = f"Database error: {e}"
        else:
            error = "Please fill in all fields."
            
    return render_template('signup.html', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

# --- API ENDPOINTS (DATA & TRANSACTION MGMT) ---

@app.route('/api/get_data', methods=['GET'])
def get_data():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # User profile data (excluding password)
            cursor.execute("SELECT id, username, email, monthly_budget, alert_enabled, theme FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            
            # Expenses
            cursor.execute("SELECT id, title, category, amount, DATE_FORMAT(date, '%%Y-%%m-%%d') as date, created_at FROM expenses WHERE user_id = %s ORDER BY date DESC, id DESC", (user_id,))
            expenses = cursor.fetchall()
            
            # Incomes
            cursor.execute("SELECT id, title, category, amount, DATE_FORMAT(date, '%%Y-%%m-%%d') as date, created_at FROM incomes WHERE user_id = %s ORDER BY date DESC, id DESC", (user_id,))
            incomes = cursor.fetchall()
            
        conn.close()
        
        # Convert Decimals to float for JSON compatibility
        if user:
            user['monthly_budget'] = float(user['monthly_budget'])
        for item in expenses + incomes:
            item['amount'] = float(item['amount'])
            
        return jsonify({
            "user": user,
            "expenses": expenses,
            "incomes": incomes
        })
    except Exception as e:
        return jsonify({"error": f"Failed to retrieve data: {e}"}), 500

@app.route('/api/add_expense', methods=['POST'])
def add_expense():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    title = request.form.get('title', '').strip()
    category = request.form.get('category', 'Other').strip()
    amount = float(request.form.get('amount', 0))
    date = request.form.get('date', datetime.today().strftime('%Y-%m-%d'))
    
    if not title or amount <= 0:
        return jsonify({"error": "Invalid title or amount"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO expenses (user_id, title, category, amount, date) VALUES (%s, %s, %s, %s, %s)",
                (user_id, title, category, amount, date)
            )
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to save expense: {e}"}), 500

@app.route('/api/delete_expense', methods=['POST'])
def delete_expense():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    expense_id = int(request.form.get('id', 0))
    
    if expense_id <= 0:
        return jsonify({"error": "Invalid expense ID"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM expenses WHERE id = %s AND user_id = %s", (expense_id, user_id))
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to delete expense: {e}"}), 500

@app.route('/api/add_income', methods=['POST'])
def add_income():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    title = request.form.get('title', '').strip()
    category = request.form.get('category', 'Salary').strip()
    amount = float(request.form.get('amount', 0))
    date = request.form.get('date', datetime.today().strftime('%Y-%m-%d'))
    
    if not title or amount <= 0:
        return jsonify({"error": "Invalid title or amount"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO incomes (user_id, title, category, amount, date) VALUES (%s, %s, %s, %s, %s)",
                (user_id, title, category, amount, date)
            )
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to save income: {e}"}), 500

@app.route('/api/delete_income', methods=['POST'])
def delete_income():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    income_id = int(request.form.get('id', 0))
    
    if income_id <= 0:
        return jsonify({"error": "Invalid income ID"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM incomes WHERE id = %s AND user_id = %s", (income_id, user_id))
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to delete income: {e}"}), 500

@app.route('/api/update_profile', methods=['POST'])
def update_profile():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip()
    monthly_budget = float(request.form.get('monthly_budget', 0))
    alert_enabled = int(request.form.get('alert_enabled', 0))
    theme = request.form.get('theme', 'system').strip()
    
    if not username or not email:
        return jsonify({"error": "Name and Email cannot be empty"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Email uniqueness check
            cursor.execute("SELECT COUNT(*) as count FROM users WHERE email = %s AND id != %s", (email, user_id))
            if cursor.fetchone()['count'] > 0:
                return jsonify({"error": "Email is already in use by another account"}), 400
                
            cursor.execute(
                "UPDATE users SET username = %s, email = %s, monthly_budget = %s, alert_enabled = %s, theme = %s WHERE id = %s",
                (username, email, monthly_budget, alert_enabled, theme, user_id)
            )
            conn.commit()
            session['username'] = username
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to update profile: {e}"}), 500

@app.route('/api/update_password', methods=['POST'])
def update_password():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    old_password = request.form.get('old_password', '')
    new_password = request.form.get('new_password', '')
    
    if not old_password or not new_password:
        return jsonify({"error": "All fields are required"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT password FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            
            if not user or not check_password_hash(user['password'], old_password):
                return jsonify({"error": "Incorrect current password"}), 400
                
            hashed_pw = generate_password_hash(new_password)
            cursor.execute("UPDATE users SET password = %s WHERE id = %s", (hashed_pw, user_id))
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to update password: {e}"}), 500

@app.route('/api/add_user', methods=['POST'])
def add_user():
    # Allows creating additional accounts from settings
    username = request.form.get('username', '').strip()
    email = request.form.get('email', '').strip()
    password = request.form.get('password', '')
    
    if not username or not email or not password:
        return jsonify({"error": "All fields are required"}), 400
        
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM users WHERE email = %s", (email,))
            if cursor.fetchone()['count'] > 0:
                return jsonify({"error": "Email is already registered"}), 400
                
            hashed_pw = generate_password_hash(password)
            cursor.execute(
                "INSERT INTO users (username, email, password, monthly_budget, alert_enabled, theme) VALUES (%s, %s, %s, 50000.00, 1, 'system')",
                (username, email, hashed_pw)
            )
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to create user account: {e}"}), 500

@app.route('/api/get_users', methods=['GET'])
def get_users():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username, email FROM users")
            users = cursor.fetchall()
        conn.close()
        return jsonify({"users": users})
    except Exception as e:
        return jsonify({"error": f"Failed to get users: {e}"}), 500

@app.route('/api/switch_user', methods=['POST'])
def switch_user():
    user_id = request.form.get('user_id')
    if not user_id:
        return jsonify({"error": "User ID is required"}), 400
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
        conn.close()
        if user:
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({"success": True})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": f"Failed to switch user: {e}"}), 500

@app.route('/api/clear_data', methods=['POST'])
def clear_data():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM expenses WHERE user_id = %s", (user_id,))
            cursor.execute("DELETE FROM incomes WHERE user_id = %s", (user_id,))
            conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": f"Failed to clear data: {e}"}), 500

@app.route('/api/export_csv')
def export_csv():
    if not is_logged_in():
        return redirect(url_for('login_page'))
        
    user_id = session['user_id']
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT 'Expense' as type, title, category, amount, DATE_FORMAT(date, '%%Y-%%m-%%d') as date, created_at FROM expenses WHERE user_id = %s UNION SELECT 'Income' as type, title, category, amount, DATE_FORMAT(date, '%%Y-%%m-%%d') as date, created_at FROM incomes WHERE user_id = %s ORDER BY date DESC", (user_id, user_id))
            records = cursor.fetchall()
        conn.close()
        
        si = io.StringIO()
        cw = csv.writer(si)
        cw.writerow(['Type', 'Title', 'Category', 'Amount (LKR)', 'Date', 'Created At'])
        for r in records:
            cw.writerow([r['type'], r['title'], r['category'], float(r['amount']), r['date'], r['created_at']])
            
        output = make_response(si.getvalue())
        output.headers["Content-Disposition"] = "attachment; filename=ledger_export.csv"
        output.headers["Content-type"] = "text/csv"
        return output
    except Exception as e:
        return f"Error exporting CSV: {e}", 500

# --- AI ADVISOR HEURISTICS ---

@app.route('/api/get_ai_tips', methods=['GET'])
def get_ai_tips():
    if not is_logged_in():
        return jsonify({"error": "Unauthorized"}), 401
        
    user_id = session['user_id']
    current_month = datetime.today().strftime('%Y-%m')
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Get user budget
            cursor.execute("SELECT username, monthly_budget, alert_enabled FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            
            # Fetch current month expenses
            cursor.execute(
                "SELECT * FROM expenses WHERE user_id = %s AND DATE_FORMAT(date, '%%Y-%%m') = %s",
                (user_id, current_month)
            )
            expenses = cursor.fetchall()
            
            # Fetch current month incomes
            cursor.execute(
                "SELECT * FROM incomes WHERE user_id = %s AND DATE_FORMAT(date, '%%Y-%%m') = %s",
                (user_id, current_month)
            )
            incomes = cursor.fetchall()
            
        conn.close()
        
        # Calculate summaries
        total_expense = sum(float(e['amount']) for e in expenses)
        total_income = sum(float(i['amount']) for i in incomes)
        budget = float(user['monthly_budget'])
        
        warnings_count = 0
        tips_count = 0
        wins_count = 0
        tips_list = []
        
        # AI Logic: Income is Low
        # We define "low income" as either total_income < 30000 or total_income < total_expense
        if total_income < 30000:
            warnings_count += 1
            tips_list.append({
                "type": "warning",
                "title": "Low Income Alert",
                "text": f"Your recorded income (LKR {total_income:,.2f}) is low. Let's look for ways to increase it! Try offering freelance services, online tutoring, or monetizing a hobby."
            })
            tips_count += 1
            tips_list.append({
                "type": "tip",
                "title": "Boost Your Earnings",
                "text": "Identify 2 marketable skills (e.g. translation, data entry, graphic design) and create a profile on platforms like Upwork or Fiverr to add an extra income stream."
            })
        elif total_income < total_expense:
            warnings_count += 1
            tips_list.append({
                "type": "warning",
                "title": "Deficit Spending",
                "text": f"You spent LKR {total_expense - total_income:,.2f} more than you earned this month. To cover this gap, consider doing short-term gigs, sell unused household goods, or request freelance work."
            })
            
        # AI Logic: Expense is High (or exceeds budget)
        if budget > 0:
            if total_expense > budget:
                warnings_count += 1
                excess = total_expense - budget
                tips_list.append({
                    "type": "warning",
                    "title": "Budget Exceeded!",
                    "text": f"Warning: You've exceeded your monthly budget of LKR {budget:,.2f} by LKR {excess:,.2f} ({int((total_expense/budget)*100)}% used). Pause non-essential spending immediately."
                })
            elif total_expense >= budget * 0.8:
                warnings_count += 1
                tips_list.append({
                    "type": "warning",
                    "title": "Approaching Budget Limit",
                    "text": f"Alert: You have spent LKR {total_expense:,.2f} ({int((total_expense/budget)*100)}% of your limit). Time to cut back on discretionary shopping and dining."
                })
            elif total_expense < budget * 0.5 and total_expense > 0:
                wins_count += 1
                tips_list.append({
                    "type": "win",
                    "title": "Excellent Budget Control",
                    "text": f"Awesome! You have only spent {int((total_expense/budget)*100)}% of your monthly budget. Keep it up!"
                })
        else:
            tips_count += 1
            tips_list.append({
                "type": "tip",
                "title": "Establish a Budget Limit",
                "text": "Setting a monthly budget limit helps the AI advisor monitor your spending and protect you from high outcomes."
            })
            
        # Category spending optimization advice
        category_totals = {}
        for e in expenses:
            cat = e['category']
            category_totals[cat] = category_totals.get(cat, 0) + float(e['amount'])
            
        for cat, amt in category_totals.items():
            if total_expense > 0 and (amt / total_expense) >= 0.4:
                tips_count += 1
                tips_list.append({
                    "type": "tip",
                    "title": f"High {cat} Concentration",
                    "text": f"Over {int((amt/total_expense)*100)}% of your total expenses went to {cat} (LKR {amt:,.2f}). Try setting a specific sub-limit for this category next week."
                })
                
        # Specific Category advice
        if category_totals.get('Food', 0) > 15000:
            tips_count += 1
            tips_list.append({
                "type": "tip",
                "title": "Reduce Dinings & Takeaways",
                "text": f"Food spending is LKR {category_totals['Food']:,.2f}. Planning weekly home meals and cooking in bulk can reduce food expenditures by up to 50%."
            })
            
        if category_totals.get('Shopping', 0) > 10000:
            tips_count += 1
            tips_list.append({
                "type": "tip",
                "title": "Apply the 48-Hour Rule",
                "text": "Before buying non-essential items, wait 48 hours. This simple delay helps curb impulsive shopping and keeps outcomes low."
            })
            
        if len(expenses) == 0 and len(incomes) == 0:
            tips_list = [{
                "type": "tip",
                "title": "Welcome to AI Financial Advisor",
                "text": "Log your income and expenses for this month to receive personalized recommendations."
            }]
            
        return jsonify({
            "warnings": warnings_count,
            "tips": tips_count,
            "wins": wins_count,
            "items": tips_list
        })
    except Exception as e:
        return jsonify({"error": f"AI evaluation error: {e}"}), 500

if __name__ == '__main__':
    # Initialize DB tables on startup
    init_db()
    # Start the server locally
    app.run(debug=True, port=5000)
