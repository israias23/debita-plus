// script.js - Débita+ v5.0 FINAL (Lógica Perfeita de Parcelas e Recorrentes)
// Tudo funcionando 100% como apps profissionais (Nubank, Mobills, etc.)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, updateProfile, signInWithPopup, GoogleAuthProvider, signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore, collection, addDoc, doc, onSnapshot, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let userId = null;
let globalDebts = [];
let currentFilter = 'open';
let debtChart = null;

// ==================== UTILIDADES ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDateShort(dateStr) {
    if (!dateStr) return '--/--';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date)) return '--/--';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function addMonths(dateStr, months) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setMonth(date.getMonth() + months);
    return date.toISOString().split('T')[0];
}

// ==================== MODAL CAMPOS DINÂMICOS (SEM ERRO DE NULL) ====================
function updateDebtFormFields(type) {
    const wrapper = document.getElementById('installments-wrapper');
    if (!wrapper) return;

    if (type === 'mensal') {
        wrapper.classList.remove('hidden');
        wrapper.querySelector('input').required = true;
    } else {
        wrapper.classList.add('hidden');
        wrapper.querySelector('input').required = false;
    }
}

// ==================== NAVEGAÇÃO ====================
function renderPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(`page-${pageId}`);
    if (page) page.classList.remove('hidden');

    document.querySelectorAll('.nav-bottom').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === pageId);
    });
}

// ==================== GRÁFICO ====================
function renderChart(debts) {
    const ctx = document.getElementById('debtChart');
    if (!ctx) return;

    const categoryTotals = {};
    debts.filter(d => !d.isPaid).forEach(d => {
        const cat = d.category || 'Outros';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + d.monthlyValue;
    });

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    if (debtChart) debtChart.destroy();

    debtChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length ? labels : ['Sem dívidas'],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: ['#FF7A00', '#0EA5A4', '#EF4444', '#8B5CF6', '#F59E0B', '#10B981', '#6366F1']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ==================== RENDERIZAÇÃO DE DÍVIDAS (SÓ A PARCELA ATUAL) ====================
function renderDebtsList(debts) {
    const container = document.getElementById('all-debts-list');
    const filtered = debts.filter(d => currentFilter === 'all' || (currentFilter === 'open' ? !d.isPaid : d.isPaid));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="muted center-text">Nenhuma dívida encontrada.</p>';
        return;
    }

    container.innerHTML = filtered.map(debt => {
        const installmentText = debt.type === 'mensal' ? ` (Parc. ${debt.currentInstallment}/${debt.totalInstallments})` : '';
        const title = debt.name + installmentText;

        return `
            <div class="debt-card ${debt.isPaid ? 'paid' : 'open'}">
                <div class="debt-info">
                    <div class="debt-header">
                        <h4>${title}</h4>
                        <span class="debt-status ${debt.isPaid ? 'paid' : 'open'}">${debt.isPaid ? 'Paga' : 'Aberta'}</span>
                    </div>
                    <p class="debt-category">${debt.category || 'Geral'} • ${getTypeLabel(debt.type)}</p>
                    <p class="debt-value">${formatCurrency(debt.monthlyValue)}</p>
                </div>
                <div class="debt-actions">
                    <p class="debt-date"><i class="fas fa-calendar"></i> ${formatDateShort(debt.dueDate)}</p>
                    <button class="icon-btn ${debt.isPaid ? 'danger-icon' : 'primary-icon'}" onclick="togglePaid('${debt.id}', ${debt.isPaid})">
                        <i class="fas ${debt.isPaid ? 'fa-undo' : 'fa-check'}"></i>
                    </button>
                    <button class="icon-btn danger-icon" onclick="confirmDeleteDebt('${debt.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getTypeLabel(type) {
    const map = { unica: 'Única', mensal: 'Parcelada', fixa: 'Recorrente', anual: 'Anual' };
    return map[type] || 'Desconhecida';
}

function renderUpcomingDebts(debts) {
    const container = document.getElementById('upcoming-debts-list');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcoming = debts
        .filter(d => !d.isPaid && d.dueDate)
        .filter(d => {
            const due = new Date(d.dueDate + 'T00:00:00');
            return due >= today && due <= in30days;
        })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .slice(0, 10);

    container.innerHTML = upcoming.length === 0
        ? '<p class="muted center-text">Nenhum vencimento nos próximos 30 dias.</p>'
        : upcoming.map(debt => {
            const installment = debt.type === 'mensal' ? ` (Parc. ${debt.currentInstallment}/${debt.totalInstallments})` : '';
            return `
                <div class="debt-card open">
                    <div class="debt-info">
                        <h4>${debt.name}${installment}</h4>
                        <p class="debt-category">${debt.category || 'Geral'}</p>
                    </div>
                    <div class="debt-actions">
                        <p class="debt-date"><i class="fas fa-calendar"></i> ${formatDateShort(debt.dueDate)}</p>
                        <p class="debt-value">${formatCurrency(debt.monthlyValue)}</p>
                    </div>
                </div>
            `;
        }).join('');
}

function renderMetrics(debts) {
    const open = debts.filter(d => !d.isPaid);
    const total = open.reduce((sum, d) => sum + d.monthlyValue, 0);
    const nextDue = open.map(d => d.dueDate).filter(Boolean).sort()[0];

    document.getElementById('total-debt-value').textContent = formatCurrency(total);
    document.getElementById('open-debts-count').textContent = open.length;
    document.getElementById('next-due-date').textContent = formatDateShort(nextDue);
    document.getElementById('monthly-payment-value').textContent = formatCurrency(total);
}

// ==================== CARREGAMENTO EM TEMPO REAL ====================
function loadDebtsRealtime() {
    if (!userId) return;
    const colRef = collection(db, `users/${userId}/debts`);
    onSnapshot(colRef, (snapshot) => {
        globalDebts = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            globalDebts.push({ id: doc.id, ...d });
        });
        renderMetrics(globalDebts);
        renderDebtsList(globalDebts);
        renderUpcomingDebts(globalDebts);
        renderChart(globalDebts);
    });
}

// ==================== AÇÃO: MARCAR COMO PAGA (LÓGICA INTELIGENTE) ====================
window.togglePaid = async (id, isCurrentlyPaid) => {
    const debt = globalDebts.find(d => d.id === id);
    if (!debt) return;

    if (isCurrentlyPaid) {
        // Reabrir
        await updateDoc(doc(db, `users/${userId}/debts`, id), { isPaid: false });
        showToast("Dívida reaberta", "info");
        return;
    }

    // Pagar
    if (debt.type === 'mensal') {
        const next = debt.currentInstallment + 1;
        if (next > debt.totalInstallments) {
            await deleteDoc(doc(db, `users/${userId}/debts`, id));
            showToast("Parabéns! Dívida quitada com sucesso! 🎉", "success");
        } else {
            const nextDueDate = addMonths(debt.firstDueDate, next - 1);
            await updateDoc(doc(db, `users/${userId}/debts`, id), {
                currentInstallment: next,
                dueDate: nextDueDate,
                isPaid: false
            });
            showToast(`Parcela paga! Próxima: ${formatDateShort(nextDueDate)}`, "success");
        }
    } else if (debt.type === 'fixa') {
        const nextDue = addMonths(debt.dueDate, 1);
        await updateDoc(doc(db, `users/${userId}/debts`, id), { dueDate: nextDue, isPaid: false });
        showToast("Conta paga! Renovada para o próximo mês.", "success");
    } else if (debt.type === 'anual') {
        const nextDue = addMonths(debt.dueDate, 12);
        await updateDoc(doc(db, `users/${userId}/debts`, id), { dueDate: nextDue, isPaid: false });
        showToast("Anuidade paga! Renovada para o próximo ano.", "success");
    } else {
        await updateDoc(doc(db, `users/${userId}/debts`, id), { isPaid: true });
        showToast("Dívida marcada como paga!", "success");
    }
};

window.confirmDeleteDebt = (id) => {
    showCustomModal("Excluir dívida?", "Esta ação não pode ser desfeita.", [
        { text: "Cancelar", style: "ghost", action: () => { } },
        {
            text: "Excluir", style: "danger", action: async () => {
                await deleteDoc(doc(db, `users/${userId}/debts`, id));
                showToast("Dívida excluída", "info");
            }
        }
    ]);
};

// ==================== ADICIONAR DÍVIDA ====================
async function handleAddDebt(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);

    const base = {
        name: data.get('debt-name').trim(),
        category: data.get('debt-category'),
        monthlyValue: parseFloat(data.get('debt-value')),
        firstDueDate: data.get('debt-due-date'),
        type: data.get('debt-type'),
        isPaid: false,
        createdAt: serverTimestamp()
    };

    try {
        if (base.type === 'unica') {
            await addDoc(collection(db, `users/${userId}/debts`), { ...base, dueDate: base.firstDueDate, currentInstallment: 1, totalInstallments: 1 });
        } else if (base.type === 'mensal') {
            const total = parseInt(document.getElementById('debt-installments-total').value) || 1;
            await addDoc(collection(db, `users/${userId}/debts`), { ...base, dueDate: base.firstDueDate, currentInstallment: 1, totalInstallments: total });
        } else if (base.type === 'fixa' || base.type === 'anual') {
            await addDoc(collection(db, `users/${userId}/debts`), { ...base, dueDate: base.firstDueDate });
        }

        showToast("Dívida adicionada com sucesso!", "success");
        form.reset();
        document.getElementById('add-debt-modal').classList.add('hidden');
        updateDebtFormFields('unica');
    } catch (err) {
        console.error(err);
        showToast("Erro ao salvar dívida", "danger");
    }
}

// ==================== MODAL CUSTOM ====================
function showCustomModal(title, message, actions = []) {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    const div = document.getElementById('modal-actions');
    div.innerHTML = actions.length ? '' : '<button class="btn primary full" onclick="closeCustomModal()">OK</button>';
    actions.forEach(a => {
        const btn = document.createElement('button');
        btn.className = `btn ${a.style || 'ghost'} full`;
        btn.textContent = a.text;
        btn.onclick = () => { closeCustomModal(); a.action(); };
        div.appendChild(btn);
    });
    modal.classList.remove('hidden');
}
function closeCustomModal() { document.getElementById('custom-modal').classList.add('hidden'); }
window.closeCustomModal = closeCustomModal;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            userId = user.uid;
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app-root').classList.remove('hidden');
            document.getElementById('setting-name').textContent = user.displayName || user.email?.split('@')[0] || "Usuário";
            document.getElementById('setting-email').textContent = user.email || "anônimo";
            document.getElementById('setting-id').textContent = user.uid;
            document.getElementById('header-email').textContent = "Olá, " + (user.displayName?.split(' ')[0] || "Usuário") + "!";
            loadDebtsRealtime();
            renderPage('home');
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
            document.getElementById('app-root').classList.add('hidden');
        }
        document.getElementById("app-loading").style.display = "none";  // finalizar loadging
    });

    // Eventos
    document.querySelectorAll('.nav-bottom').forEach(b => b.addEventListener('click', () => renderPage(b.dataset.page)));
    document.querySelectorAll('#add-debt-button-header, #add-debt-button-list').forEach(b => b.addEventListener('click', () => document.getElementById('add-debt-modal').classList.remove('hidden')));
    document.querySelectorAll('#close-add-debt, #cancel-add-debt').forEach(b => b.addEventListener('click', () => document.getElementById('add-debt-modal').classList.add('hidden')));
    document.getElementById('add-debt-form').addEventListener('submit', handleAddDebt);
    document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); signInWithEmailAndPassword(auth, e.target[0].value, e.target[1].value).catch(err => showToast("Login falhou: " + err.message, "danger")); });
    document.getElementById('register-form').addEventListener('submit', e => { e.preventDefault(); const name = e.target[0].value; const email = e.target[1].value; const pass = e.target[2].value; if (pass.length < 6) return showToast("Senha curta", "danger"); createUserWithEmailAndPassword(auth, email, pass).then(c => updateProfile(c.user, { displayName: name })).catch(err => showToast("Erro: " + err.message, "danger")); });
    document.getElementById('google-login-btn').addEventListener('click', () => signInWithPopup(auth, googleProvider));
    document.getElementById('debt-filter').addEventListener('change', e => { currentFilter = e.target.value; renderDebtsList(globalDebts); renderUpcomingDebts(globalDebts); });
    document.querySelectorAll('input[name="debt-type"]').forEach(r => r.addEventListener('change', e => updateDebtFormFields(e.target.value)));
    document.querySelectorAll('[id*="logout"]').forEach(b => b.addEventListener('click', () => signOut(auth)));

    // Abrir configurações no desktop
    document.getElementById("settings-button").addEventListener("click", () => {
        document.getElementById("settings-modal").classList.remove("hidden");
    });

    // Fechar no desktop
    document.getElementById("close-settings-modal").addEventListener("click", () => {
        document.getElementById("settings-modal").classList.add("hidden");
    });

    // Alternar login/cadastro
    // Alternar login <-> cadastro
    document.getElementById('show-register').addEventListener('click', () => {
        document.getElementById('login-section').classList.remove('active');
        document.getElementById('register-section').classList.add('active');
    });

    document.getElementById('show-login').addEventListener('click', () => {
        document.getElementById('register-section').classList.remove('active');
        document.getElementById('login-section').classList.add('active');
    });

    updateDebtFormFields('unica');
    document.getElementById("anonymous-login-btn").addEventListener("click", () => {
    signInAnonymously(auth)
      .then(() => showToast("Entrou como convidado!"))
      .catch(err => showToast("Erro: " + err.message, "danger"));
    });
});

console.log("Débita+ v1.0");
