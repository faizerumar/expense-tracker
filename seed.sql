USE expense_tracker;
INSERT INTO users (id, username, email, password, monthly_budget, alert_enabled, theme) 
VALUES (1, 'Umar', 'umar@example.com', '$2y$10$.yoQtRkqGssq8NIfidKE.erRZctros0.Ht/V9T0W1W4zCxXsvZfkG', 100000.00, 1, 'system')
ON DUPLICATE KEY UPDATE username='Umar';

INSERT INTO expenses (user_id, title, category, amount, date) VALUES
(1, 'Groceries', 'Groceries', 1200.00, '2026-06-21'),
(1, 'Bought a laptop', 'Other', 65000.00, '2026-06-21'),
(1, 'From Badulla to Colombo', 'Bus Fare', 1500.00, '2026-06-21');
