// ----- Data & storage -----
const KEY = "pfm_transactions_v1";
let transactions = JSON.parse(localStorage.getItem(KEY)) || [];

// DOM elements
const totalIncomeEl = document.getElementById("total-income");
const totalExpenseEl = document.getElementById("total-expense");
const balanceEl = document.getElementById("balance");
const txForm = document.getElementById("tx-form");
const txTableBody = document.getElementById("tx-table-body");

const filterFrom = document.getElementById("filter-from");
const filterTo = document.getElementById("filter-to");
const filterCategory = document.getElementById("filter-category");
const applyFilterBtn = document.getElementById("apply-filter");
const resetFilterBtn = document.getElementById("reset-filter");
const exportCsvBtn = document.getElementById("export-csv");
const clearAllBtn = document.getElementById("clear-all");

// Charts
let pieChart, barChart;

// Helpers
function save() {
  localStorage.setItem(KEY, JSON.stringify(transactions));
}

function formatAmount(n) {
  return Number(n).toFixed(2);
}

function formatDateInputToDisplay(dateStr) {
  // dateStr: YYYY-MM-DD
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString();
}

// ----- CRUD & UI -----
function addTransaction(tx) {
  transactions.push(tx);
  save();
  render();
}

function deleteTransaction(index) {
  if (!confirm("Delete this transaction?")) return;
  transactions.splice(index, 1);
  save();
  render();
}

function clearAll() {
  if (!confirm("Clear ALL transactions? This cannot be undone.")) return;
  transactions = [];
  save();
  render();
}

clearAllBtn.addEventListener("click", clearAll);

// Render table and summary
function calculateTotals(list) {
  let income = 0, expense = 0;
  list.forEach(t => {
    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  });
  return { income, expense, balance: income - expense };
}

function renderTable(list) {
  txTableBody.innerHTML = "";
  list.forEach((t, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td class="text-capitalize">${t.type}</td>
      <td>${t.name}</td>
      <td>${formatAmount(t.amount)}</td>
      <td>${t.category}</td>
      <td>${formatDateInputToDisplay(t.date)}</td>
      <td>
        <button class="btn btn-sm btn-danger" data-index="${i}">Delete</button>
      </td>
    `;
    txTableBody.appendChild(tr);
  });

  // attach delete handlers
  txTableBody.querySelectorAll("button[data-index]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const i = Number(e.currentTarget.getAttribute("data-index"));
      deleteTransaction(i);
    });
  });
}

// ----- Charts Data -----
function getCategorySums(list) {
  const sums = {};
  list.forEach(t => {
    if (t.type === "expense") {
      sums[t.category] = (sums[t.category] || 0) + Number(t.amount);
    }
  });
  return sums;
}

function getMonthlySeries(list) {
  // returns labels sorted (YYYY-MM) and dataset for income & expense
  const map = {}; // { '2025-09': {income: x, expense: y} }
  list.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) map[key] = { income: 0, expense: 0 };
    if (t.type === "income") map[key].income += Number(t.amount);
    else map[key].expense += Number(t.amount);
  });

  const keys = Object.keys(map).sort();
  const incomeArr = keys.map(k => map[k].income);
  const expenseArr = keys.map(k => map[k].expense);
  const labels = keys.map(k => {
    const [y,m] = k.split("-");
    const dt = new Date(Number(y), Number(m)-1, 1);
    return dt.toLocaleString(undefined, { month: "short", year: "numeric" });
  });

  return { labels, incomeArr, expenseArr };
}

// ----- Chart rendering -----
function renderPieChart(labelVals) {
  const ctx = document.getElementById("pie-chart").getContext("2d");
  const labels = Object.keys(labelVals);
  const vals = Object.values(labelVals);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: vals
      }]
    },
    options: {
      plugins: { legend: { position: "bottom" } }
    }
  });
}

function renderBarChart(series) {
  const ctx = document.getElementById("bar-chart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        { label: "Income", data: series.incomeArr, stack: "stack1" },
        { label: "Expense", data: series.expenseArr, stack: "stack1" }
      ]
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: false } }
    }
  });
}

// ----- Main render -----
function render(filteredList = null) {
  const list = filteredList || transactions;
  // summary
  const totals = calculateTotals(list);
  totalIncomeEl.textContent = `${formatAmount(totals.income)} ₹`;
  totalExpenseEl.textContent = `${formatAmount(totals.expense)} ₹`;
  balanceEl.textContent = `${formatAmount(totals.balance)} ₹`;

  // table
  renderTable(list);

  // charts (charts are based on all stored transactions, not only filtered)
  const catSums = getCategorySums(transactions);
  renderPieChart(catSums);

  const series = getMonthlySeries(transactions);
  renderBarChart(series);
}

// ----- Filters -----
function applyFilter() {
  let list = transactions.slice();
  const from = filterFrom.value;
  const to = filterTo.value;
  const cat = filterCategory.value;

  if (from) {
    const fromTime = new Date(from + "T00:00:00").getTime();
    list = list.filter(t => new Date(t.date + "T00:00:00").getTime() >= fromTime);
  }
  if (to) {
    const toTime = new Date(to + "T23:59:59").getTime();
    list = list.filter(t => new Date(t.date + "T00:00:00").getTime() <= toTime);
  }
  if (cat) {
    list = list.filter(t => t.category === cat);
  }

  render(list);
}

applyFilterBtn.addEventListener("click", applyFilter);
resetFilterBtn.addEventListener("click", () => {
  filterFrom.value = "";
  filterTo.value = "";
  filterCategory.value = "";
  render();
});

// ----- CSV Export -----
function exportToCSV() {
  if (!transactions.length) {
    alert("No transactions to export.");
    return;
  }
  const headers = ["Type","Name","Amount","Category","Date"];
  const rows = transactions.map(t => [
    t.type, t.name, Number(t.amount).toFixed(2), t.category, t.date
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.map(field => `"${String(field).replace(/"/g,'""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
exportCsvBtn.addEventListener("click", exportToCSV);

// ----- Form submit -----
txForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const type = document.getElementById("tx-type").value;
  const name = document.getElementById("tx-name").value.trim();
  const amount = parseFloat(document.getElementById("tx-amount").value);
  const category = document.getElementById("tx-category").value;
  const date = document.getElementById("tx-date").value; // YYYY-MM-DD

  if (!name || !amount || !category || !date) {
    alert("Please fill all fields.");
    return;
  }

  addTransaction({ type, name, amount: Number(amount), category, date });
  txForm.reset();
  // default date to today for faster entry
  document.getElementById("tx-date").value = new Date().toISOString().slice(0,10);
});

// initialize default date input
document.getElementById("tx-date").value = new Date().toISOString().slice(0,10);

// Initial render
render();
