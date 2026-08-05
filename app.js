(function () {
  'use strict';

  var LS_BACKEND_URL = 'far_backend_url';

  var state = {
    backendUrl: localStorage.getItem(LS_BACKEND_URL) || '',
    recetas: [],
    ingredientes: [],
    preparacion: [],
    recetaActual: null,
    filtroCategoria: 'Todas',
    reunidosMap: {},   // { receta_id: Set<indice_ingrediente> }
    pasosMap: {}       // { receta_id: Set<indice_paso> }
  };

  // ---------- Utils ----------

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function fmt(v) {
    var n = parseFloat(v);
    if (isNaN(n)) return escapeHtml(v);
    return (n % 1 === 0) ? n.toString() : parseFloat(n.toFixed(2)).toString();
  }

  var toastTimer;
  function toast(msg, type) {
    var el = document.getElementById('kds-toast');
    el.textContent = msg;
    el.className = 'kds-toast show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function showLoader(text) {
    document.getElementById('loader-text').textContent = text || 'Cargando…';
    document.getElementById('loader').classList.remove('hidden');
  }
  function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  }

  function showErr(msg) {
    var el = document.getElementById('setup-error');
    el.textContent = '⚠️ ' + msg;
    el.classList.add('show');
  }
  function hideErr() {
    document.getElementById('setup-error').classList.remove('show');
  }

  // ---------- Reloj ----------

  setInterval(function () {
    var el = document.getElementById('header-time');
    if (el) el.textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  // ---------- Conexión / setup ----------

  function conectar(auto) {
    var input = document.getElementById('setup-url');
    var url = (input.value.trim()) || state.backendUrl;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      if (!auto) showErr('La URL no parece válida. Debe verse como https://script.google.com/macros/s/AAAA.../exec');
      return;
    }

    var btn = document.getElementById('btn-connect');
    btn.disabled = true;
    btn.textContent = 'Conectando…';
    hideErr();
    showLoader('Cargando recetas…');

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('El servidor no respondió (HTTP ' + res.status + ').');
        return res.json();
      })
      .then(function (data) {
        state.backendUrl = url;
        localStorage.setItem(LS_BACKEND_URL, url);
        state.recetas = data.recetas || [];
        state.ingredientes = data.ingredientes || [];
        state.preparacion = data.preparacion || [];

        document.getElementById('screen-setup').style.display = 'none';
        document.getElementById('app').classList.add('show');

        renderFiltros();
        renderLista(state.recetas);
        hideLoader();
      })
      .catch(function (err) {
        hideLoader();
        btn.disabled = false;
        btn.textContent = 'Conectar y abrir recetario →';
        if (!auto) {
          showErr('No se pudo conectar: ' + err.message);
        } else {
          document.getElementById('screen-setup').style.display = 'flex';
        }
      });
  }

  function volverConfigurar() {
    document.getElementById('app').classList.remove('show');
    document.getElementById('screen-setup').style.display = 'flex';
    document.getElementById('setup-url').value = state.backendUrl;
    var btn = document.getElementById('btn-connect');
    btn.disabled = false;
    btn.textContent = 'Conectar y abrir recetario →';
  }

  // ---------- Sidebar: filtros + búsqueda + lista ----------

  function renderFiltros() {
    var categorias = ['Todas'];
    state.recetas.forEach(function (r) {
      if (r.categoria && categorias.indexOf(r.categoria) === -1) categorias.push(r.categoria);
    });
    var cont = document.getElementById('type-filters');
    cont.innerHTML = categorias.map(function (c) {
      return '<button type="button" class="filter-chip' + (c === state.filtroCategoria ? ' active' : '') + '" data-categoria="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    }).join('');
    cont.querySelectorAll('.filter-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filtroCategoria = btn.getAttribute('data-categoria');
        cont.querySelectorAll('.filter-chip').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        filtrar();
      });
    });
  }

  function filtrar() {
    var q = (document.getElementById('search-input').value || '').trim().toLowerCase();
    var lista = state.recetas.filter(function (r) {
      var coincideTexto = !q || (r.nombre || '').toLowerCase().indexOf(q) !== -1;
      var coincideCategoria = state.filtroCategoria === 'Todas' || r.categoria === state.filtroCategoria;
      return coincideTexto && coincideCategoria;
    });
    renderLista(lista);
  }

  function renderLista(lista) {
    var cont = document.getElementById('recipe-list');
    if (!lista.length) {
      cont.innerHTML = '<div class="sidebar-empty">Sin resultados</div>';
      return;
    }
    cont.innerHTML = lista.map(function (r) {
      var activa = state.recetaActual && state.recetaActual.receta_id === r.receta_id;
      return '<div class="recipe-item' + (activa ? ' active' : '') + '" data-id="' + escapeHtml(r.receta_id) + '">' +
        '<div class="recipe-item-name">' + escapeHtml(r.nombre) + '</div>' +
        '<div class="recipe-item-type">' + escapeHtml(r.categoria || 'Receta') + '</div>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('.recipe-item').forEach(function (item) {
      item.addEventListener('click', function () {
        cargarReceta(item.getAttribute('data-id'));
      });
    });
  }

  // ---------- Sidebar móvil ----------

  function toggleSidebar() {
    var open = document.getElementById('kds-sidebar').classList.toggle('open');
    document.getElementById('kds-sidebar-overlay').classList.toggle('show', open);
  }
  function closeSidebar() {
    document.getElementById('kds-sidebar').classList.remove('open');
    document.getElementById('kds-sidebar-overlay').classList.remove('show');
  }

  // ---------- Cargar / renderizar receta ----------

  function cargarReceta(id) {
    closeSidebar();
    var receta = state.recetas.filter(function (r) { return r.receta_id === id; })[0];
    if (!receta) return;
    state.recetaActual = receta;
    if (!state.reunidosMap[id]) state.reunidosMap[id] = {};
    if (!state.pasosMap[id]) state.pasosMap[id] = {};
    renderReceta();
    filtrar();
  }

  function volverInicio() {
    state.recetaActual = null;
    renderReceta();
    filtrar();
  }

  function renderReceta() {
    var main = document.getElementById('kds-main');
    var r = state.recetaActual;

    if (!r) {
      main.innerHTML =
        '<div class="kds-empty">' +
        '<div class="big-icon">🍽</div>' +
        '<h2>Selecciona una receta</h2>' +
        '<p>Elige del panel izquierdo. Verás los ingredientes a reunir y el paso a paso de la preparación.</p>' +
        '</div>';
      return;
    }

    var ingredientes = state.ingredientes.filter(function (i) { return i.receta_id === r.receta_id; });
    var pasos = state.preparacion
      .filter(function (p) { return p.receta_id === r.receta_id; })
      .sort(function (a, b) { return Number(a.paso_num) - Number(b.paso_num); });

    var reunidos = state.reunidosMap[r.receta_id] || {};
    var hechos = state.pasosMap[r.receta_id] || {};
    var totalPasos = pasos.length;
    var doneCount = Object.keys(hechos).filter(function (k) { return hechos[k]; }).length;
    var pct = totalPasos ? Math.round((doneCount / totalPasos) * 100) : 0;

    var notesHTML = r.notas
      ? '<div class="recipe-notes">📌 <span>' + escapeHtml(r.notas) + '</span></div>'
      : '';

    var html =
      '<button type="button" class="btn-volver-inicio" id="btn-volver-inicio">← Volver al inicio</button>' +
      '<div class="recipe-header">' +
      '<div class="recipe-image">🍽</div>' +
      '<div>' +
      '<div class="recipe-name">' + escapeHtml(r.nombre) + '</div>' +
      '<div class="recipe-badges">' +
      '<span class="badge badge-green">' + escapeHtml(r.categoria || 'Receta') + '</span>' +
      (r.porciones ? '<span class="badge badge-blue">' + escapeHtml(r.porciones) + '</span>' : '') +
      (r.tiempo_prep ? '<span class="badge badge-amber">⏱ ' + escapeHtml(r.tiempo_prep) + '</span>' : '') +
      (ingredientes.length ? '<span class="badge badge-gray">' + ingredientes.length + ' ingredientes</span>' : '') +
      (totalPasos ? '<span class="badge badge-gray">' + totalPasos + ' pasos</span>' : '') +
      '</div>' +
      '</div>' +
      '</div>' +
      notesHTML +
      (totalPasos ? (
        '<div class="recipe-progress">' +
        '<span style="font-size:11px;color:var(--text2)">Progreso de preparación</span>' +
        '<div class="progress-bar-outer"><div class="progress-bar-inner" id="prog-bar" style="width:' + pct + '%"></div></div>' +
        '<span class="progress-pct" id="prog-pct">' + doneCount + '/' + totalPasos + '</span>' +
        '</div>'
      ) : '') +
      (ingredientes.length ? (
        '<div class="section-title">🥩 Ingredientes a reunir</div>' +
        '<div class="ingredients-grid" id="ingredients-grid">' +
        ingredientes.map(function (ing, idx) {
          var marcado = !!reunidos[idx];
          return '<div class="ingredient-card' + (marcado ? ' reunido' : '') + '" data-idx="' + idx + '">' +
            '<span class="ingredient-check">' + (marcado ? '✓' : '') + '</span>' +
            '<div><span class="ingredient-qty">' + fmt(ing.cantidad) + '</span><span class="ingredient-unit">' + escapeHtml(ing.unidad) + '</span></div>' +
            '<div class="ingredient-name">' + escapeHtml(ing.ingrediente) + '</div>' +
            '</div>';
        }).join('') +
        '</div>'
      ) : '') +
      (totalPasos ? (
        '<div class="section-title">📋 Preparación</div>' +
        '<div id="steps-wrap">' +
        pasos.map(function (p, idx) {
          var isDone = !!hechos[idx];
          return '<div class="step-card' + (isDone ? ' done' : '') + '" data-idx="' + idx + '">' +
            '<div class="step-num">' + (isDone ? '✓' : (idx + 1)) + '</div>' +
            '<div class="step-text">' + escapeHtml(p.instruccion) + '</div>' +
            '<div class="step-chk">' + (isDone ? '✓' : '') + '</div>' +
            '</div>';
        }).join('') +
        '</div>' +
        '<button type="button" class="btn-reset-pasos" id="btn-reset-pasos">↺ Reiniciar pasos</button>'
      ) : (
        '<div style="padding:48px;text-align:center;color:var(--text3)">' +
        '<div style="font-size:32px;opacity:0.3;margin-bottom:12px">📋</div>' +
        '<div>Sin pasos registrados para esta receta.</div>' +
        '</div>'
      ));

    main.innerHTML = html;

    document.getElementById('btn-volver-inicio').addEventListener('click', volverInicio);

    var grid = document.getElementById('ingredients-grid');
    if (grid) {
      grid.querySelectorAll('.ingredient-card').forEach(function (card) {
        card.addEventListener('click', function () {
          toggleIngrediente(Number(card.getAttribute('data-idx')));
        });
      });
    }

    var stepsWrap = document.getElementById('steps-wrap');
    if (stepsWrap) {
      stepsWrap.querySelectorAll('.step-card').forEach(function (card) {
        card.addEventListener('click', function () {
          togglePaso(Number(card.getAttribute('data-idx')), totalPasos);
        });
      });
    }

    var btnReset = document.getElementById('btn-reset-pasos');
    if (btnReset) {
      btnReset.addEventListener('click', resetPasos);
    }
  }

  function toggleIngrediente(idx) {
    var r = state.recetaActual;
    if (!r) return;
    var mapa = state.reunidosMap[r.receta_id] || {};
    mapa[idx] = !mapa[idx];
    state.reunidosMap[r.receta_id] = mapa;
    var card = document.querySelector('#ingredients-grid .ingredient-card[data-idx="' + idx + '"]');
    if (card) {
      card.classList.toggle('reunido', !!mapa[idx]);
      card.querySelector('.ingredient-check').textContent = mapa[idx] ? '✓' : '';
    }
  }

  function togglePaso(idx, total) {
    var r = state.recetaActual;
    if (!r) return;
    var mapa = state.pasosMap[r.receta_id] || {};
    mapa[idx] = !mapa[idx];
    state.pasosMap[r.receta_id] = mapa;

    var card = document.querySelector('#steps-wrap .step-card[data-idx="' + idx + '"]');
    if (card) {
      var done = !!mapa[idx];
      card.classList.toggle('done', done);
      card.querySelector('.step-num').textContent = done ? '✓' : (idx + 1);
      card.querySelector('.step-chk').textContent = done ? '✓' : '';
    }

    var doneCount = Object.keys(mapa).filter(function (k) { return mapa[k]; }).length;
    var pct = total ? Math.round((doneCount / total) * 100) : 0;
    var bar = document.getElementById('prog-bar');
    var pctEl = document.getElementById('prog-pct');
    if (bar) bar.style.width = pct + '%';
    if (pctEl) pctEl.textContent = doneCount + '/' + total;

    if (pct === 100) toast('✅ ¡Receta completada!', 's');
  }

  function resetPasos() {
    var r = state.recetaActual;
    if (!r) return;
    state.pasosMap[r.receta_id] = {};
    renderReceta();
    toast('Pasos reiniciados', '');
  }

  // ---------- Arranque ----------

  document.addEventListener('DOMContentLoaded', function () {
    if (state.backendUrl) {
      document.getElementById('setup-url').value = state.backendUrl;
      conectar(true);
    }

    document.getElementById('btn-connect').addEventListener('click', function () { conectar(false); });
    document.getElementById('btn-configurar').addEventListener('click', volverConfigurar);
    document.getElementById('btn-mob-menu').addEventListener('click', toggleSidebar);
    document.getElementById('kds-sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('search-input').addEventListener('input', filtrar);
  });
})();
