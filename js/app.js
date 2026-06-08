'use strict';

// ─── STATE ───────────────────────────────────────────────
const STORAGE_KEY = 'rice-ia-projects';

const state = {
  projects: [],
  deletingId: null,
  editingId: null,
  chart: null,
};

// ─── UTILS ───────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function calcRice(reach, impact, confidence, effort) {
  if (!reach || !impact || !confidence || !effort) return 0;
  return Math.round((reach * impact * confidence) / effort * 10) / 10;
}

function priorityInfo(score) {
  if (score >= 100) return { label: 'Crítico',  cls: 'priority-critical', color: '#10b981' };
  if (score >= 50)  return { label: 'Alto',     cls: 'priority-high',     color: '#3b82f6' };
  if (score >= 20)  return { label: 'Médio',    cls: 'priority-medium',   color: '#f59e0b' };
  return               { label: 'Baixo',    cls: 'priority-low',      color: '#ef4444' };
}

function fmtNum(n) {
  return Number.isInteger(n) ? n.toLocaleString('pt-BR') : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtConfidence(v) {
  const map = { '1': '100%', '0.8': '80%', '0.5': '50%' };
  return map[String(v)] || (v * 100) + '%';
}

function impactLabel(v) {
  const map = { '3': '3 — Massivo', '2': '2 — Alto', '1': '1 — Médio', '0.5': '0,5 — Baixo', '0.25': '0,25 — Mínimo' };
  return map[String(v)] || v;
}

// ─── PERSISTENCE ─────────────────────────────────────────
function loadProjects() {
  try {
    state.projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    state.projects = [];
  }
}

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
}

// ─── RENDER ──────────────────────────────────────────────
function renderProjects() {
  const sorted = [...state.projects].sort((a, b) => b.riceScore - a.riceScore);
  const grid   = document.getElementById('projectsGrid');
  const empty  = document.getElementById('emptyState');
  const chart  = document.getElementById('chartSection');

  if (sorted.length === 0) {
    grid.classList.add('d-none');
    empty.classList.remove('d-none');
    chart.classList.add('d-none');
    destroyChart();
    return;
  }

  empty.classList.add('d-none');
  grid.classList.remove('d-none');
  chart.classList.remove('d-none');

  grid.innerHTML = '';
  sorted.forEach((p, idx) => {
    const rankNum  = idx + 1;
    const rankCls  = rankNum <= 3 ? `rank-${rankNum}` : 'rank-n';
    const priority = priorityInfo(p.riceScore);

    const card = document.createElement('div');
    card.className = 'col-md-6 col-xl-4';
    card.innerHTML = `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-header">
          <span class="rank-badge ${rankCls}">${rankNum}º</span>
          <span class="project-name">${escHtml(p.name)}</span>
          <div class="card-actions ms-auto flex-shrink-0">
            <button class="btn-card-action edit" title="Editar" data-id="${p.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn-card-action delete" title="Remover" data-id="${p.id}"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
        ${p.description ? `<p class="project-desc">${escHtml(p.description)}</p>` : ''}
        <div class="project-metrics">
          <div class="metric-item">
            <span class="metric-label">Alcance</span>
            <span class="metric-val reach-val">${fmtNum(p.reach)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Impacto</span>
            <span class="metric-val impact-val">${p.impact}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Confiança</span>
            <span class="metric-val confidence-val">${fmtConfidence(p.confidence)}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">Esforço</span>
            <span class="metric-val effort-val">${p.effort}m</span>
          </div>
        </div>
        <div class="project-card-footer">
          <div>
            <div class="metric-label mb-1">Score RICE</div>
            <div class="rice-score-display" style="color: ${priority.color}">${fmtNum(p.riceScore)}</div>
          </div>
          <span class="priority-badge ${priority.cls}">${priority.label}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // delegated event listeners
  grid.querySelectorAll('.btn-card-action.edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  grid.querySelectorAll('.btn-card-action.delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });

  renderChart(sorted);
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── CHART ───────────────────────────────────────────────
function renderChart(sorted) {
  const ctx    = document.getElementById('riceChart').getContext('2d');
  const labels = sorted.map(p => p.name.length > 28 ? p.name.slice(0, 26) + '…' : p.name);
  const scores = sorted.map(p => p.riceScore);
  const colors = sorted.map(p => priorityInfo(p.riceScore).color);

  destroyChart();

  state.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Score RICE',
        data: scores,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Score RICE: ${fmtNum(ctx.raw)}`,
          },
          titleFont: { weight: 'bold' },
          backgroundColor: '#1e293b',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 12 } },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 12 } },
        },
      },
    },
  });
}

function destroyChart() {
  if (state.chart) { state.chart.destroy(); state.chart = null; }
}

// ─── MODAL — ADD / EDIT ───────────────────────────────────
const projectModal   = document.getElementById('projectModal');
const bsProjectModal = new bootstrap.Modal(projectModal);

const fName       = () => document.getElementById('projectName');
const fDesc       = () => document.getElementById('projectDesc');
const fReach      = () => document.getElementById('reach');
const fImpact     = () => document.getElementById('impact');
const fConfidence = () => document.getElementById('confidence');
const fEffort     = () => document.getElementById('effort');

function resetForm() {
  const form = document.getElementById('projectForm');
  form.classList.remove('was-validated');
  form.reset();
  document.getElementById('projectId').value = '';
  document.getElementById('scorePreview').classList.add('d-none');
  document.getElementById('modalTitleText').textContent = 'Novo Projeto de IA';
  state.editingId = null;
}

function openEditModal(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  resetForm();
  state.editingId = id;
  document.getElementById('modalTitleText').textContent = 'Editar Projeto';
  document.getElementById('projectId').value = id;
  fName().value = p.name;
  fDesc().value = p.description || '';
  fReach().value = p.reach;
  fImpact().value = p.impact;
  fConfidence().value = p.confidence;
  fEffort().value = p.effort;
  updateScorePreview();
  bsProjectModal.show();
}

projectModal.addEventListener('hidden.bs.modal', resetForm);

document.getElementById('btnSaveProject').addEventListener('click', saveProject);

function saveProject() {
  const form = document.getElementById('projectForm');
  form.classList.add('was-validated');

  const reach      = parseFloat(fReach().value);
  const impact     = parseFloat(fImpact().value);
  const confidence = parseFloat(fConfidence().value);
  const effort     = parseFloat(fEffort().value);
  const name       = fName().value.trim();

  if (!form.checkValidity() || !name || !reach || !impact || !confidence || !effort) return;

  const score = calcRice(reach, impact, confidence, effort);

  if (state.editingId) {
    const idx = state.projects.findIndex(x => x.id === state.editingId);
    if (idx !== -1) {
      state.projects[idx] = { ...state.projects[idx], name, description: fDesc().value.trim(), reach, impact, confidence, effort, riceScore: score };
    }
    showToast('Projeto atualizado com sucesso!', 'success');
  } else {
    state.projects.push({
      id: genId(),
      name,
      description: fDesc().value.trim(),
      reach, impact, confidence, effort,
      riceScore: score,
      createdAt: new Date().toISOString(),
    });
    showToast('Projeto adicionado com sucesso!', 'success');
  }

  saveProjects();
  renderProjects();
  bsProjectModal.hide();
}

// Live score preview
['reach', 'impact', 'confidence', 'effort'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateScorePreview);
  document.getElementById(id).addEventListener('change', updateScorePreview);
});

function updateScorePreview() {
  const r = parseFloat(fReach().value);
  const i = parseFloat(fImpact().value);
  const c = parseFloat(fConfidence().value);
  const e = parseFloat(fEffort().value);

  if (!r || !i || !c || !e) {
    document.getElementById('scorePreview').classList.add('d-none');
    return;
  }

  const score = calcRice(r, i, c, e);
  const priority = priorityInfo(score);

  document.getElementById('scorePreview').classList.remove('d-none');
  document.getElementById('scoreValue').textContent  = fmtNum(score);
  document.getElementById('scoreValue').style.color  = priority.color;
  document.getElementById('scoreFormula').textContent =
    `(${fmtNum(r)} × ${i} × ${fmtConfidence(c)}) ÷ ${e}m = ${fmtNum(score)}`;
}

// ─── DELETE ───────────────────────────────────────────────
const deleteModal   = document.getElementById('deleteModal');
const bsDeleteModal = new bootstrap.Modal(deleteModal);

function openDeleteModal(id) {
  state.deletingId = id;
  bsDeleteModal.show();
}

document.getElementById('btnConfirmDelete').addEventListener('click', () => {
  state.projects = state.projects.filter(p => p.id !== state.deletingId);
  state.deletingId = null;
  saveProjects();
  renderProjects();
  bsDeleteModal.hide();
  showToast('Projeto removido.', 'info');
});

// ─── EXPORT CSV ───────────────────────────────────────────
document.getElementById('btnExport').addEventListener('click', exportCSV);

function exportCSV() {
  if (state.projects.length === 0) {
    showToast('Nenhum projeto para exportar.', 'danger');
    return;
  }

  const sorted = [...state.projects].sort((a, b) => b.riceScore - a.riceScore);
  const header = ['Ranking', 'Nome', 'Descrição', 'Alcance (Reach)', 'Impacto (Impact)', 'Confiança (Confidence)', 'Esforço (Effort, meses-pessoa)', 'Score RICE', 'Prioridade'].join(';');

  const rows = sorted.map((p, idx) => [
    idx + 1,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    p.reach,
    p.impact,
    fmtConfidence(p.confidence),
    p.effort,
    p.riceScore,
    priorityInfo(p.riceScore).label,
  ].join(';'));

  const csv  = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `rice-scoring-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exportado com sucesso!', 'success');
}

// ─── TOAST ───────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el   = document.getElementById('appToast');
  const body = document.getElementById('toastMessage');
  el.className = `toast align-items-center border-0 text-white bg-${type}`;
  body.textContent = msg;
  new bootstrap.Toast(el, { delay: 3000 }).show();
}

// ─── SMOOTH SCROLL ───────────────────────────────────────
document.getElementById('btnLearnMore').addEventListener('click', () => {
  document.getElementById('guideSection').scrollIntoView({ behavior: 'smooth' });
});

// ─── BOOTSTRAP POPOVERS ──────────────────────────────────
function initPopovers() {
  document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
    const pop = bootstrap.Popover.getInstance(el);
    if (pop) pop.dispose();
    new bootstrap.Popover(el, { html: true, sanitize: false });
  });

  // close on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-bs-toggle="popover"]')) {
      document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => {
        bootstrap.Popover.getInstance(el)?.hide();
      });
    }
  });
}

// Re-init popovers when modal opens (Bootstrap re-renders the DOM)
projectModal.addEventListener('shown.bs.modal', initPopovers);

// ─── INIT ────────────────────────────────────────────────
loadProjects();
renderProjects();
initPopovers();
