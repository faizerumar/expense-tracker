// Application State (In-Memory reactive store)
let state = {
    user: null,
    expenses: [],
    incomes: [],
    activeTab: 'home',
    currentPeriod: new Date() // Used for Analytics month selector
};

// Configuration of Icons and Accent Colors matching category designations
const categoryConfig = {
    // Expense Categories
    'Groceries': { icon: 'shopping-cart', color: '#f97316', bg: '#fff7ed' },
    'Bus Fare': { icon: 'bus', color: '#ffb800', bg: '#fefbeb' },
    'Three-wheel': { icon: 'car', color: '#10b981', bg: '#ecfdf5' },
    'Food': { icon: 'utensils', color: '#ef4444', bg: '#fef2f2' },
    'Shopping': { icon: 'shopping-bag', color: '#ec4899', bg: '#fdf2f8' },
    'Entertainment': { icon: 'film', color: '#8b5cf6', bg: '#f5f3ff' },
    'Bills': { icon: 'credit-card', color: '#3b82f6', bg: '#eff6ff' },
    'Other': { icon: 'help-circle', color: '#6b7280', bg: '#f3f4f6' },
    
    // Income Categories
    'Salary': { icon: 'briefcase', color: '#10b981', bg: '#ecfdf5' },
    'Freelance': { icon: 'code', color: '#3b82f6', bg: '#eff6ff' },
    'Investments': { icon: 'trending-up', color: '#8b5cf6', bg: '#f5f3ff' },
    'Gift': { icon: 'gift', color: '#ec4899', bg: '#fdf2f8' }
};

// Initialize Application when DOM fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// Load backend data and initialize UI
async function initApp() {
    await fetchAppState();
    applyTheme(state.user?.theme || 'system');
    renderCurrentTab();
}

// Fetch complete app state (user, expenses, incomes) from Python API
async function fetchAppState() {
    try {
        const response = await fetch('/api/get_data');
        if (response.status === 401) {
            // If unauthorized, redirect directly to login page
            window.location.href = '/login';
            return;
        }
        const data = await response.json();
        state.user = data.user;
        state.expenses = data.expenses || [];
        state.incomes = data.incomes || [];
    } catch (err) {
        console.error('Failed to load application data:', err);
    }
}

// Bind all UI interactive event listeners
function setupEventListeners() {
    // Left Sidebar Menu tab switches
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const tab = e.currentTarget.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    // Add Expense Modal open/close actions
    const expenseModal = document.getElementById('modal-add-expense');
    document.getElementById('btn-add-expense').addEventListener('click', () => {
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        expenseModal.classList.add('active');
    });
    document.getElementById('modal-btn-close').addEventListener('click', () => {
        expenseModal.classList.remove('active');
    });
    expenseModal.addEventListener('click', (e) => {
        if (e.target === expenseModal) expenseModal.classList.remove('active');
    });

    // Save Expense transaction submission
    document.getElementById('form-add-expense').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('expense-amount').value;
        const title = document.getElementById('expense-title').value;
        const category = document.getElementById('expense-category').value;
        const date = document.getElementById('expense-date').value;

        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('title', title);
        formData.append('category', category);
        formData.append('date', date);

        try {
            const res = await fetch('/api/add_expense', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                document.getElementById('form-add-expense').reset();
                expenseModal.classList.remove('active');
                await initApp();
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to save expense');
            }
        } catch (err) {
            console.error(err);
        }
    });

    // Add Income Modal open/close actions
    const incomeModal = document.getElementById('modal-add-income');
    const addIncomeBtn = document.getElementById('btn-add-income');
    if (addIncomeBtn) {
        addIncomeBtn.addEventListener('click', () => {
            document.getElementById('income-date').value = new Date().toISOString().split('T')[0];
            incomeModal.classList.add('active');
        });
    }
    document.getElementById('modal-income-btn-close').addEventListener('click', () => {
        incomeModal.classList.remove('active');
    });
    incomeModal.addEventListener('click', (e) => {
        if (e.target === incomeModal) incomeModal.classList.remove('active');
    });

    // Save Income transaction submission
    document.getElementById('form-add-income').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('income-amount').value;
        const title = document.getElementById('income-title').value;
        const category = document.getElementById('income-category').value;
        const date = document.getElementById('income-date').value;

        const formData = new FormData();
        formData.append('amount', amount);
        formData.append('title', title);
        formData.append('category', category);
        formData.append('date', date);

        try {
            const res = await fetch('/api/add_income', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                document.getElementById('form-add-income').reset();
                incomeModal.classList.remove('active');
                await initApp();
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to save income');
            }
        } catch (err) {
            console.error(err);
        }
    });

    // Searches & Filters triggers
    document.getElementById('expense-search').addEventListener('input', () => {
        renderExpensesTab();
    });
    document.getElementById('income-search').addEventListener('input', () => {
        renderIncomeTab();
    });

    // Analytics Month navigation buttons
    document.getElementById('btn-prev-month').addEventListener('click', () => {
        state.currentPeriod.setMonth(state.currentPeriod.getMonth() - 1);
        renderAnalyticsTab();
    });
    document.getElementById('btn-next-month').addEventListener('click', () => {
        state.currentPeriod.setMonth(state.currentPeriod.getMonth() + 1);
        renderAnalyticsTab();
    });

    // AI Tips refresh action trigger
    document.getElementById('btn-refresh-tips').addEventListener('click', () => {
        renderAiTipsTab();
    });

    // Edit Profile Account submission form
    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('profile-name-input').value;
        const email = document.getElementById('profile-email-input').value;
        const monthly_budget = document.getElementById('profile-budget-input').value;
        const alert_enabled = document.getElementById('profile-alert-checkbox').checked ? 1 : 0;
        const theme = state.user?.theme || 'system';

        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);
        formData.append('monthly_budget', monthly_budget);
        formData.append('alert_enabled', alert_enabled);
        formData.append('theme', theme);

        try {
            const res = await fetch('/api/update_profile', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                alert('Account details updated successfully!');
                await initApp();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update account');
            }
        } catch (err) {
            console.error(err);
        }
    });



    // Settings Profile quick changes (Budget limit, alert notification)
    document.getElementById('profile-budget-input').addEventListener('change', saveSettings);
    document.getElementById('profile-alert-checkbox').addEventListener('change', saveSettings);

    // Profile Settings theme buttons switcher
    document.querySelectorAll('.btn-theme').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedTheme = e.currentTarget.getAttribute('data-theme');
            saveSettingsTheme(selectedTheme);
        });
    });

    // Clear Ledger Data button click
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all your income and expense records? This cannot be undone.')) {
            try {
                const res = await fetch('/api/clear_data', { method: 'POST' });
                if (res.ok) {
                    await initApp();
                }
            } catch (err) {
                console.error(err);
            }
        }
    });

    // Add User Modal Trigger and submit listeners
    const addUserModal = document.getElementById('modal-add-user');
    document.getElementById('btn-add-user-modal').addEventListener('click', () => {
        addUserModal.classList.add('active');
    });
    document.getElementById('modal-user-btn-close').addEventListener('click', () => {
        addUserModal.classList.remove('active');
    });
    addUserModal.addEventListener('click', (e) => {
        if (e.target === addUserModal) addUserModal.classList.remove('active');
    });

    document.getElementById('form-add-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('new-username').value;
        const email = document.getElementById('new-email').value;
        const password = document.getElementById('new-password').value;

        const formData = new FormData();
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);

        try {
            const res = await fetch('/api/add_user', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                document.getElementById('form-add-user').reset();
                addUserModal.classList.remove('active');
                alert('Additional user account created successfully!');
            } else {
                const errData = await res.json();
                alert(errData.error || 'Failed to create user.');
            }
        } catch (err) {
            console.error(err);
        }
    });

    // Switch User Modal Trigger and list populate listeners
    const switchUserModal = document.getElementById('modal-switch-user');
    window.openSwitchUserModal = async function() {
        switchUserModal.classList.add('active');
        const listEl = document.getElementById('switch-user-list');
        listEl.innerHTML = '<p class="text-secondary" style="text-align: center; padding: 15px;">Loading accounts...</p>';
        
        try {
            const res = await fetch('/api/get_users');
            const data = await res.json();
            
            listEl.innerHTML = '';
            if (data.users) {
                data.users.forEach(u => {
                    const item = document.createElement('div');
                    const isActive = state.user && state.user.id === u.id;
                    item.className = `switch-user-item ${isActive ? 'active' : ''}`;
                    item.innerHTML = `
                        <div>
                            <div class="switch-user-item-name">${escapeHTML(u.username)}</div>
                            <div class="switch-user-item-email">${escapeHTML(u.email)}</div>
                        </div>
                        ${isActive ? '<span class="text-success" style="font-size: 13px; font-weight: 600;">Active</span>' : ''}
                    `;
                    
                    if (!isActive) {
                        item.addEventListener('click', async () => {
                            const formData = new FormData();
                            formData.append('user_id', u.id);
                            const switchRes = await fetch('/api/switch_user', {
                                method: 'POST',
                                body: formData
                            });
                            if (switchRes.ok) {
                                switchUserModal.classList.remove('active');
                                await initApp();
                            } else {
                                alert('Failed to switch user account.');
                            }
                        });
                    }
                    listEl.appendChild(item);
                });
            }
        } catch (err) {
            console.error(err);
            listEl.innerHTML = '<p class="text-danger" style="text-align: center; padding: 15px;">Error loading accounts</p>';
        }
    };
    
    document.getElementById('modal-switch-btn-close').addEventListener('click', () => {
        switchUserModal.classList.remove('active');
    });
    switchUserModal.addEventListener('click', (e) => {
        if (e.target === switchUserModal) switchUserModal.classList.remove('active');
    });
}

// Router tab switcher
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Update sidebar navigation selection visual indicators
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Switch visible view panel
    document.querySelectorAll('.app-views .view').forEach(view => {
        if (view.id === `view-${tabId}`) {
            view.classList.add('active');
        } else {
            view.classList.remove('active');
        }
    });

    renderCurrentTab();
}

// Refresh dynamic view contents depending on selected active tab
function renderCurrentTab() {
    switch (state.activeTab) {
        case 'home':
            renderHomeTab();
            break;
        case 'income':
            renderIncomeTab();
            break;
        case 'expenses':
            renderExpensesTab();
            break;
        case 'analytics':
            renderAnalyticsTab();
            break;
        case 'ai-tips':
            renderAiTipsTab();
            break;
        case 'profile':
            renderProfileTab();
            break;
    }
}

// Formatting helpers
function formatLKR(amount) {
    return 'LKR ' + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthNameYear(date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getRecordsForMonth(recordsList, yearMonthStr) {
    return recordsList.filter(rec => rec.date.startsWith(yearMonthStr));
}

// RENDER HOME / DASHBOARD TAB
function renderHomeTab() {
    // Populate header greetings and sidebar name
    document.getElementById('header-greeting').textContent = `Hello, ${state.user?.username || 'User'}`;
    document.getElementById('sidebar-username').textContent = state.user?.username || 'User';
    document.getElementById('sidebar-avatar-char').textContent = (state.user?.username || 'U')[0].toUpperCase();

    const now = new Date();
    const curYearMonth = now.toISOString().slice(0, 7);
    document.getElementById('header-period').textContent = now.toLocaleDateString('en-US', { month: 'long' }) + ' Overview';

    // Current Month Incomes Total Calculation
    const curMonthIncomes = getRecordsForMonth(state.incomes, curYearMonth);
    const totalIncome = curMonthIncomes.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    document.getElementById('home-total-income').textContent = formatLKR(totalIncome);
    document.getElementById('home-income-count').textContent = `${curMonthIncomes.length} deposits recorded this month`;

    // Current Month Expenses Total Calculation
    const curMonthExpenses = getRecordsForMonth(state.expenses, curYearMonth);
    const totalSpent = curMonthExpenses.reduce((sum, item) => sum + parseFloat(item.amount), 0);
    document.getElementById('home-total-spent').textContent = formatLKR(totalSpent);
    document.getElementById('home-transaction-count').textContent = `${curMonthExpenses.length} transactions recorded this month`;

    // Net savings calculation
    const netSavings = totalIncome - totalSpent;
    document.getElementById('home-net-savings').textContent = formatLKR(netSavings);
    
    const savingsStatusEl = document.getElementById('home-savings-status');
    if (netSavings < 0) {
        savingsStatusEl.textContent = 'Deficit Spending! Check AI tips';
        savingsStatusEl.style.color = '#fee2e2';
    } else {
        savingsStatusEl.textContent = 'Surplus / On Track';
        savingsStatusEl.style.color = '#d1fae5';
    }

    // Render Home Top Spending Categories
    const categoryTotals = {};
    curMonthExpenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + parseFloat(exp.amount);
    });

    const sortedCats = Object.keys(categoryTotals).sort((a,b) => categoryTotals[b] - categoryTotals[a]).slice(0, 3);
    const topCatsGrid = document.getElementById('home-top-categories');
    if (topCatsGrid) topCatsGrid.remove(); // Clean up if existing in older dashboard, we have unified view

    // Combine recent activities (Incomes and Expenses combined sorted by date)
    const recentList = document.getElementById('home-recent-expenses');
    recentList.innerHTML = '';

    const combinedLedger = [
        ...state.expenses.map(e => ({ ...e, type: 'expense' })),
        ...state.incomes.map(i => ({ ...i, type: 'income' }))
    ].sort((a,b) => new Date(b.date) - new Date(a.date) || b.id - a.id).slice(0, 6);

    if (combinedLedger.length === 0) {
        recentList.innerHTML = '<p class="text-secondary" style="text-align: center; padding: 24px 0;">No ledger activities recorded yet</p>';
    } else {
        combinedLedger.forEach(item => {
            const config = categoryConfig[item.category] || categoryConfig['Other'];
            const cardEl = document.createElement('div');
            cardEl.className = 'expense-item';
            
            const isInc = item.type === 'income';
            const colorClass = isInc ? 'text-success' : 'text-danger';
            const sign = isInc ? '+' : '-';
            const displayAmt = `${sign} ${formatLKR(item.amount)}`;

            cardEl.innerHTML = `
                <div class="expense-left">
                    <div class="cat-icon-wrapper" style="background-color: ${config.bg}; color: ${config.color}; border-radius: 50%;">
                        <i data-lucide="${config.icon}"></i>
                    </div>
                    <div class="expense-info">
                        <span class="expense-title">${escapeHTML(item.title)}</span>
                        <span class="expense-category" style="text-transform: capitalize;">${item.type} • ${item.category}</span>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount ${colorClass}" style="font-weight: 600;">${displayAmt}</span>
                </div>
            `;
            recentList.appendChild(cardEl);
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// RENDER INCOME TAB
function renderIncomeTab() {
    const searchVal = document.getElementById('income-search').value.toLowerCase();
    
    // Filter incomes
    let filtered = state.incomes.filter(inc => {
        return inc.title.toLowerCase().includes(searchVal) || inc.category.toLowerCase().includes(searchVal);
    });

    const listContainer = document.getElementById('income-list-container');
    listContainer.innerHTML = '';

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-secondary" style="text-align: center; padding: 48px 0;">No incomes logged matching the criteria</p>';
        return;
    }

    // Group by Date
    const groups = {};
    filtered.forEach(inc => {
        const dateStr = formatExpenseDateHeader(inc.date);
        if (!groups[dateStr]) groups[dateStr] = { records: [], total: 0 };
        groups[dateStr].records.push(inc);
        groups[dateStr].total += parseFloat(inc.amount);
    });

    Object.keys(groups).forEach(dateStr => {
        const group = groups[dateStr];
        const groupEl = document.createElement('div');
        groupEl.className = 'expense-date-group';
        
        groupEl.innerHTML = `
            <div class="date-group-header">
                <span>${dateStr}</span>
                <span class="text-success">+ ${formatLKR(group.total)}</span>
            </div>
            <div class="expenses-list-wide"></div>
        `;
        
        const listEl = groupEl.querySelector('.expenses-list-wide');
        group.records.forEach(inc => {
            const config = categoryConfig[inc.category] || categoryConfig['Other'];
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <div class="expense-left">
                    <div class="cat-icon-wrapper" style="background-color: ${config.bg}; color: ${config.color}; border-radius: 50%;">
                        <i data-lucide="${config.icon}"></i>
                    </div>
                    <div class="expense-info">
                        <span class="expense-title">${escapeHTML(inc.title)}</span>
                        <span class="expense-category">${inc.category} • ${formatDateSubtitle(inc.date)}</span>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount text-success">+ ${formatLKR(inc.amount)}</span>
                    <button class="btn-delete" data-id="${inc.id}" title="Delete record">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            item.querySelector('.btn-delete').addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Delete this income record?')) {
                    const formData = new FormData();
                    formData.append('id', id);
                    const res = await fetch('/api/delete_income', {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        await initApp();
                    }
                }
            });

            listEl.appendChild(item);
        });

        listContainer.appendChild(groupEl);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// RENDER EXPENSES TAB (with category filters and search)
let activeCategoryFilter = 'All';
function renderExpensesTab() {
    const searchVal = document.getElementById('expense-search').value.toLowerCase();
    
    // Render Category Filter pills bar
    const filtersContainer = document.getElementById('expense-filters');
    filtersContainer.innerHTML = '';
    
    const expenseCategories = ['All', 'Groceries', 'Bus Fare', 'Three-wheel', 'Food', 'Shopping', 'Entertainment', 'Bills', 'Other'];
    expenseCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `btn-filter ${activeCategoryFilter === cat ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            activeCategoryFilter = cat;
            renderExpensesTab();
        });
        filtersContainer.appendChild(btn);
    });

    // Filter expenses
    let filtered = state.expenses.filter(exp => {
        const matchesSearch = exp.title.toLowerCase().includes(searchVal) || exp.category.toLowerCase().includes(searchVal);
        const matchesCat = activeCategoryFilter === 'All' || exp.category === activeCategoryFilter;
        return matchesSearch && matchesCat;
    });

    const listContainer = document.getElementById('expenses-list-container');
    listContainer.innerHTML = '';

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-secondary" style="text-align: center; padding: 48px 0;">No expenses logged matching the criteria</p>';
        return;
    }

    // Group by Date
    const groups = {};
    filtered.forEach(exp => {
        const dateStr = formatExpenseDateHeader(exp.date);
        if (!groups[dateStr]) groups[dateStr] = { expenses: [], total: 0 };
        groups[dateStr].expenses.push(exp);
        groups[dateStr].total += parseFloat(exp.amount);
    });

    Object.keys(groups).forEach(dateStr => {
        const group = groups[dateStr];
        const groupEl = document.createElement('div');
        groupEl.className = 'expense-date-group';
        
        groupEl.innerHTML = `
            <div class="date-group-header">
                <span>${dateStr}</span>
                <span class="text-danger">- ${formatLKR(group.total)}</span>
            </div>
            <div class="expenses-list-wide"></div>
        `;
        
        const listEl = groupEl.querySelector('.expenses-list-wide');
        group.expenses.forEach(exp => {
            const config = categoryConfig[exp.category] || categoryConfig['Other'];
            const item = document.createElement('div');
            item.className = 'expense-item';
            item.innerHTML = `
                <div class="expense-left">
                    <div class="cat-icon-wrapper" style="background-color: ${config.bg}; color: ${config.color}; border-radius: 50%;">
                        <i data-lucide="${config.icon}"></i>
                    </div>
                    <div class="expense-info">
                        <span class="expense-title">${escapeHTML(exp.title)}</span>
                        <span class="expense-category">${exp.category} • ${formatDateSubtitle(exp.date)}</span>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount text-danger">- ${formatLKR(exp.amount)}</span>
                    <button class="btn-delete" data-id="${exp.id}" title="Delete record">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;

            item.querySelector('.btn-delete').addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm('Delete this expense record?')) {
                    const formData = new FormData();
                    formData.append('id', id);
                    const res = await fetch('/api/delete_expense', {
                        method: 'POST',
                        body: formData
                    });
                    if (res.ok) {
                        await initApp();
                    }
                }
            });

            listEl.appendChild(item);
        });

        listContainer.appendChild(groupEl);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function formatExpenseDateHeader(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateSubtitle(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// RENDER ANALYTICS TAB
function renderAnalyticsTab() {
    const periodStr = state.currentPeriod.toISOString().slice(0, 7); // YYYY-MM
    document.getElementById('analytics-month-text').textContent = getMonthNameYear(state.currentPeriod);

    const periodExpenses = getRecordsForMonth(state.expenses, periodStr);
    const totalSpent = periodExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    document.getElementById('donut-center-val').textContent = formatLKR(totalSpent);

    // Aggregate category totals
    const totals = {};
    periodExpenses.forEach(exp => {
        totals[exp.category] = (totals[exp.category] || 0) + parseFloat(exp.amount);
    });

    // 1. Draw SVG Donut segments
    const svg = document.getElementById('donut-svg');
    // Clear old segment elements
    while (svg.lastChild && svg.children.length > 2) {
        svg.removeChild(svg.lastChild);
    }

    const legend = document.getElementById('donut-legend');
    legend.innerHTML = '';

    if (totalSpent === 0) {
        legend.innerHTML = '<p class="text-secondary" style="text-align: center; padding: 20px 0;">No expense records logged this month</p>';
        return;
    }

    let cumulativePercentage = 0;
    const sorted = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);
    
    sorted.forEach((cat) => {
        const amount = totals[cat];
        const percentage = (amount / totalSpent) * 100;
        const config = categoryConfig[cat] || categoryConfig['Other'];

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '21');
        circle.setAttribute('cy', '21');
        circle.setAttribute('r', '15.91549430918954');
        circle.setAttribute('fill', 'transparent');
        circle.setAttribute('stroke', config.color);
        circle.setAttribute('stroke-width', '3.5');
        circle.setAttribute('stroke-dasharray', `${percentage} ${100 - percentage}`);
        const offset = 100 - cumulativePercentage;
        circle.setAttribute('stroke-dashoffset', `${offset}`);

        svg.appendChild(circle);
        cumulativePercentage += percentage;

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <div class="legend-left">
                <span class="legend-color-dot" style="background-color: ${config.color}"></span>
                <span>${cat}</span>
            </div>
            <span class="legend-percentage">${round(percentage, 1)}%</span>
        `;
        legend.appendChild(legendItem);
    });

    // 2. Weekly Bar Chart Breakdown
    const weeklyData = [0, 0, 0, 0, 0];
    periodExpenses.forEach(exp => {
        const day = new Date(exp.date).getDate();
        if (day <= 7) weeklyData[0] += parseFloat(exp.amount);
        else if (day <= 14) weeklyData[1] += parseFloat(exp.amount);
        else if (day <= 21) weeklyData[2] += parseFloat(exp.amount);
        else if (day <= 28) weeklyData[3] += parseFloat(exp.amount);
        else weeklyData[4] += parseFloat(exp.amount);
    });

    const maxWeekly = Math.max(...weeklyData, 1000);
    const barChartContainer = document.getElementById('weekly-chart');
    barChartContainer.innerHTML = '';

    weeklyData.forEach((weekTotal, index) => {
        const barHeight = (weekTotal / maxWeekly) * 100;
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-wrapper';
        barWrapper.innerHTML = `
            <div class="bar-container" title="Wk ${index+1}: ${formatLKR(weekTotal)}">
                <div class="bar-fill" style="height: ${barHeight}%"></div>
            </div>
            <span class="bar-label">Week ${index+1}</span>
        `;
        barChartContainer.appendChild(barWrapper);
    });
}

// RENDER AI FINANCIAL ADVISOR SUGGESTIONS
async function renderAiTipsTab() {
    const tipsContainer = document.getElementById('ai-tips-container');
    tipsContainer.innerHTML = '<p class="text-secondary" style="grid-column: span 2; text-align: center; padding: 24px;">AI is evaluating budget limits and outcomes...</p>';

    try {
        const res = await fetch('/api/get_ai_tips');
        const data = await res.json();

        document.getElementById('ai-stat-warnings').textContent = data.warnings;
        document.getElementById('ai-stat-tips').textContent = data.tips;
        document.getElementById('ai-stat-wins').textContent = data.wins;

        tipsContainer.innerHTML = '';

        data.items.forEach(tip => {
            const card = document.createElement('div');
            card.className = 'tip-card';
            
            let iconClass = 'tip-icon';
            let iconName = 'lightbulb';
            if (tip.type === 'warning') {
                iconClass = 'warning-icon';
                iconName = 'alert-triangle';
            } else if (tip.type === 'win') {
                iconClass = 'win-icon';
                iconName = 'trophy';
            }

            card.innerHTML = `
                <div class="tip-icon-box ${iconClass}">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="tip-content-box">
                    <span class="tip-title">${escapeHTML(tip.title)}</span>
                    <span class="tip-text">${escapeHTML(tip.text)}</span>
                </div>
            `;
            tipsContainer.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        tipsContainer.innerHTML = '<p class="text-danger" style="grid-column: span 2; text-align: center; padding: 24px;">Failed to fetch financial advice.</p>';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// RENDER PROFILE & SETTINGS TAB
function renderProfileTab() {
    document.getElementById('profile-username').textContent = state.user?.username || 'User';
    document.getElementById('profile-email').textContent = state.user?.email || 'email@example.com';
    document.getElementById('profile-avatar-char').textContent = (state.user?.username || 'U')[0].toUpperCase();
    
    // Fill Edit Profile form fields
    document.getElementById('profile-name-input').value = state.user?.username || '';
    document.getElementById('profile-email-input').value = state.user?.email || '';

    // Set budget limit inputs
    document.getElementById('profile-budget-input').value = Math.round(state.user?.monthly_budget || 0);
    document.getElementById('profile-alert-checkbox').checked = parseInt(state.user?.alert_enabled) === 1;

    // Output record status sizes
    const totalRecords = state.expenses.length + state.incomes.length;
    document.getElementById('profile-record-count').textContent = `${totalRecords} transactions available >`;

    // Active theme highlighting
    const theme = state.user?.theme || 'system';
    document.querySelectorAll('.btn-theme').forEach(btn => {
        if (btn.getAttribute('data-theme') === theme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Save budget constraints auto triggers on fields modify
async function saveSettings() {
    const username = document.getElementById('profile-name-input').value || state.user.username;
    const email = document.getElementById('profile-email-input').value || state.user.email;
    const monthly_budget = document.getElementById('profile-budget-input').value;
    const alert_enabled = document.getElementById('profile-alert-checkbox').checked ? 1 : 0;
    const theme = state.user?.theme || 'system';

    const formData = new FormData();
    formData.append('username', username);
    formData.append('email', email);
    formData.append('monthly_budget', monthly_budget);
    formData.append('alert_enabled', alert_enabled);
    formData.append('theme', theme);

    try {
        const res = await fetch('/api/update_profile', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            await initApp();
        }
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
}

// Save theme selection settings
async function saveSettingsTheme(themeName) {
    const monthly_budget = document.getElementById('profile-budget-input').value || state.user.monthly_budget;
    const alert_enabled = document.getElementById('profile-alert-checkbox').checked ? 1 : 0;

    const formData = new FormData();
    formData.append('username', state.user.username);
    formData.append('email', state.user.email);
    formData.append('monthly_budget', monthly_budget);
    formData.append('alert_enabled', alert_enabled);
    formData.append('theme', themeName);

    try {
        const res = await fetch('/api/update_profile', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            state.user.theme = themeName;
            
            document.querySelectorAll('.btn-theme').forEach(btn => {
                if (btn.getAttribute('data-theme') === themeName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            applyTheme(themeName);
        }
    } catch (err) {
        console.error('Failed to update theme:', err);
    }
}

// Apply selected theme to document root node
function applyTheme(theme) {
    localStorage.setItem('theme', theme);
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (theme === 'dark' || (theme === 'system' && systemPrefersDark)) {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }
}

// Watch system theme change if system setting selected
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.user?.theme === 'system') {
        applyTheme('system');
    }
});

// HTML escaping helper
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Math round utility helper
function round(value, decimals = 0) {
    return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}
