<?php
require_once 'auth.php';
require_once 'db.php';

header('Content-Type: application/json');

if (!is_logged_in()) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

$user_id = get_logged_in_user_id();
$action = $_GET['action'] ?? '';

// Fetch active user data helper
function fetch_user_data($pdo, $user_id) {
    $stmt = $pdo->prepare('SELECT id, username, email, monthly_budget, alert_enabled, theme FROM users WHERE id = ?');
    $stmt->execute([$user_id]);
    return $stmt->fetch();
}

if ($action === 'get_data') {
    $user = fetch_user_data($pdo, $user_id);
    
    // Fetch all expenses for this user
    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC');
    $stmt->execute([$user_id]);
    $expenses = $stmt->fetchAll();
    
    echo json_encode([
        "user" => $user,
        "expenses" => $expenses
    ]);
    exit;
}

if ($action === 'add_expense') {
    $title = trim($_POST['title'] ?? '');
    $category = trim($_POST['category'] ?? 'Other');
    $amount = floatval($_POST['amount'] ?? 0);
    $date = $_POST['date'] ?? date('Y-m-d');

    if ($title === '' || $amount <= 0) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid title or amount"]);
        exit;
    }

    $stmt = $pdo->prepare('INSERT INTO expenses (user_id, title, category, amount, date) VALUES (?, ?, ?, ?, ?)');
    if ($stmt->execute([$user_id, $title, $category, $amount, $date])) {
        echo json_encode(["success" => true, "user" => fetch_user_data($pdo, $user_id)]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to add expense"]);
    }
    exit;
} 

if ($action === 'delete_expense') {
    $id = intval($_POST['id'] ?? 0);

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(["error" => "Invalid expense ID"]);
        exit;
    }

    // Verify owner
    $stmt = $pdo->prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
    if ($stmt->execute([$id, $user_id])) {
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to delete expense"]);
    }
    exit;
}

if ($action === 'update_profile') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $monthly_budget = floatval($_POST['monthly_budget'] ?? 0);
    $alert_enabled = intval($_POST['alert_enabled'] ?? 0);
    $theme = trim($_POST['theme'] ?? 'system');

    if ($username === '' || $email === '') {
        http_response_code(400);
        echo json_encode(["error" => "Name and Email cannot be empty"]);
        exit;
    }

    // Check email uniqueness if changed
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ? AND id != ?');
    $stmt->execute([$email, $user_id]);
    if ($stmt->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(["error" => "Email is already in use by another account"]);
        exit;
    }

    $stmt = $pdo->prepare('UPDATE users SET username = ?, email = ?, monthly_budget = ?, alert_enabled = ?, theme = ? WHERE id = ?');
    if ($stmt->execute([$username, $email, $monthly_budget, $alert_enabled, $theme, $user_id])) {
        echo json_encode(["success" => true, "user" => fetch_user_data($pdo, $user_id)]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to update profile"]);
    }
    exit;
}

if ($action === 'clear_data') {
    $stmt = $pdo->prepare('DELETE FROM expenses WHERE user_id = ?');
    if ($stmt->execute([$user_id])) {
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to clear expenses"]);
    }
    exit;
}

if ($action === 'get_ai_tips') {
    $user = fetch_user_data($pdo, $user_id);
    
    // Fetch user's expenses this month
    $current_month = date('Y-m');
    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE user_id = ? AND DATE_FORMAT(date, "%Y-%m") = ?');
    $stmt->execute([$user_id, $current_month]);
    $expenses = $stmt->fetchAll();
    
    $total_spent = 0;
    $category_totals = [];
    foreach ($expenses as $exp) {
        $amount = floatval($exp['amount']);
        $total_spent += $amount;
        $cat = $exp['category'];
        $category_totals[$cat] = ($category_totals[$cat] ?? 0) + $amount;
    }
    
    $warnings_count = 0;
    $tips_count = 0;
    $wins_count = 0;
    $tips_list = [];
    
    $budget = floatval($user['monthly_budget']);
    $alert_enabled = intval($user['alert_enabled']) === 1;
    
    // Rule 1: Budget Warnings
    if ($budget > 0) {
        if ($total_spent > $budget) {
            $warnings_count++;
            $excess = $total_spent - $budget;
            $tips_list[] = [
                "type" => "warning",
                "title" => "Budget Exceeded!",
                "text" => "Warning: You've exceeded your monthly budget of LKR " . number_format($budget) . " by LKR " . number_format($excess) . " (" . round(($total_spent / $budget) * 100) . "% used). Consider pausing non-essential spending."
            ];
        } else if ($total_spent >= $budget * 0.8 && $alert_enabled) {
            $warnings_count++;
            $tips_list[] = [
                "type" => "warning",
                "title" => "Budget Alert (>80%)",
                "text" => "Alert: You have spent LKR " . number_format($total_spent) . " which is " . round(($total_spent / $budget) * 100) . "% of your monthly limit (LKR " . number_format($budget) . "). Plan carefully for the rest of the month."
            ];
        } else if ($total_spent < $budget * 0.5 && $total_spent > 0) {
            $wins_count++;
            $tips_list[] = [
                "type" => "win",
                "title" => "On Track!",
                "text" => "Great job! You have used only " . round(($total_spent / $budget) * 100) . "% of your budget. You are on track to save at least LKR " . number_format($budget - $total_spent) . " this month!"
            ];
        }
    } else {
        $tips_count++;
        $tips_list[] = [
            "type" => "tip",
            "title" => "Set a Monthly Budget",
            "text" => "You haven't defined a monthly budget in your Profile. Setting a target budget helps you track progress and triggers spending alerts."
        ];
    }
    
    // Rule 2: Category Spending Concentration
    if ($total_spent > 0) {
        foreach ($category_totals as $cat => $amount) {
            $percentage = ($amount / $total_spent) * 100;
            if ($percentage >= 50) {
                $tips_count++;
                $tips_list[] = [
                    "type" => "tip",
                    "title" => "High Spending: " . htmlspecialchars($cat),
                    "text" => round($percentage) . "% of your expenses this month go to \"" . htmlspecialchars($cat) . "\" (LKR " . number_format($amount) . "). Review if this is necessary and look for ways to reduce it."
                ];
            }
        }
    }
    
    // Rule 3: Category Specific Tips
    if (isset($category_totals['Food']) && $category_totals['Food'] > 10000) {
        $tips_count++;
        $tips_list[] = [
            "type" => "tip",
            "title" => "Reduce Dining Out",
            "text" => "Your food expenses are higher this month (LKR " . number_format($category_totals['Food']) . "). Try planning weekly groceries and preparing meals at home to cut costs by up to 40%."
        ];
    }
    if ((isset($category_totals['Transport']) && $category_totals['Transport'] > 5000) || (isset($category_totals['Bus Fare']) && $category_totals['Bus Fare'] > 5000)) {
        $tips_count++;
        $tips_list[] = [
            "type" => "tip",
            "title" => "Optimize Travel Cost",
            "text" => "Transit expenditures are picking up. Look into monthly travel cards, public commuting, or carpooling options to save money."
        ];
    }
    
    // General Income booster tip
    $tips_count++;
    $tips_list[] = [
        "type" => "tip",
        "title" => "Increase Passive Income",
        "text" => "Consider putting some of your monthly savings into high-yield savings accounts or mutual funds to grow your lower passive income stream over time."
    ];

    if (count($expenses) === 0) {
        $tips_list = [[
            "type" => "tip",
            "title" => "No transactions recorded yet",
            "text" => "Add your expenses for this month to receive personalized advice and spending tips based on your real logs."
        ]];
    }

    echo json_encode([
        "warnings" => $warnings_count,
        "tips" => $tips_count,
        "wins" => $wins_count,
        "items" => $tips_list
    ]);
    exit;
}

if ($action === 'add_user') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $email === '' || $password === '') {
        http_response_code(400);
        echo json_encode(["error" => "All fields are required."]);
        exit;
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetchColumn() > 0) {
        http_response_code(400);
        echo json_encode(["error" => "Email is already registered."]);
        exit;
    }

    $hashed_password = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare('INSERT INTO users (username, email, password, monthly_budget, alert_enabled, theme) VALUES (?, ?, ?, 50000.00, 1, "system")');
    if ($stmt->execute([$username, $email, $hashed_password])) {
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Failed to create user account."]);
    }
    exit;
}     

if ($action === 'export_csv') {
    // Override Content-Type header to serve CSV
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="expenses_export_' . date('Ymd') . '.csv"');
    
    $output = fopen('php://output', 'w');
    fputcsv($output, ['ID', 'Title', 'Category', 'Amount (LKR)', 'Date', 'Created At']);
    
    $stmt = $pdo->prepare('SELECT id, title, category, amount, date, created_at FROM expenses WHERE user_id = ? ORDER BY date DESC');
    $stmt->execute([$user_id]);
    
    while ($row = $stmt->fetch()) {
        fputcsv($output, $row);
    }
    fclose($output);
    exit;
}

http_response_code(400);
echo json_encode(["error" => "Invalid action"]);
exit;
