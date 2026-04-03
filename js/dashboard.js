(function () {
  "use strict";

  var API = "api.php";
  var COLORS = {
    blue: "#5b8def",
    green: "#4cceac",
    red: "#ff6b6b",
    yellow: "#ffd166",
    purple: "#b48eff",
    cyan: "#4dc9f6",
    orange: "#ff9f43",
    pink: "#f368e0",
    lime: "#84cc16",
    teal: "#14b8a6",
  };
  var PALETTE = Object.values(COLORS);
  var GRID_COLOR = "#1e3050";

  var charts = {};
  var currentPage = 1;

  // ── Helpers ──

  function fmt(n) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function fmtShort(n) {
    if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(1) + "M";
    if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(1) + "k";
    return "$" + n.toFixed(0);
  }

  function formatDate(d) {
    if (!d) return "-";
    var parts = d.split("-");
    return parts[2] + "/" + parts[1];
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  async function fetchApi(action, extraParams) {
    var params = new URLSearchParams(getFilterParams());
    params.set("action", action);
    if (extraParams) {
      for (var k in extraParams) params.set(k, extraParams[k]);
    }
    var resp = await fetch(API + "?" + params.toString());
    return resp.json();
  }

  // ── Filters ──

  function getFilterParams() {
    var params = {};
    var fi = document.getElementById("filterFechaInicio").value;
    var ff = document.getElementById("filterFechaFin").value;
    if (fi) params.fecha_inicio = fi;
    if (ff) params.fecha_fin = ff;
    var asesores = getActiveChips("filterAsesor");
    if (asesores.length) params.asesor = asesores.join(",");
    var tipos = getActiveChips("filterTipo");
    if (tipos.length) params.tipo = tipos.join(",");
    var medios = getActiveChips("filterMedio");
    if (medios.length) params.medio = medios.join(",");
    var moras = getActiveChips("filterMora");
    if (moras.length) params.mora = moras.join(",");
    return params;
  }

  function getActiveChips(containerId) {
    var chips = document
      .getElementById(containerId)
      .querySelectorAll(".chip.active");
    var vals = [];
    for (var i = 0; i < chips.length; i++) vals.push(chips[i].dataset.value);
    return vals;
  }

  function createChips(containerId, values) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    values.forEach(function (val) {
      var chip = document.createElement("span");
      chip.className = "chip";
      chip.dataset.value = val;
      chip.textContent = val || "(vacío)";
      chip.addEventListener("click", function () {
        chip.classList.toggle("active");
      });
      container.appendChild(chip);
    });
  }

  async function initFilters() {
    var data = await fetchApi("filters");
    createChips("filterAsesor", data.asesores || []);
    createChips("filterTipo", data.tipos || []);
    createChips("filterMedio", data.medios || []);
    createChips("filterMora", data.moras || []);
    if (data.fecha_min) {
      document.getElementById("filterFechaInicio").value = data.fecha_min;
      document.getElementById("filterFechaFin").value = data.fecha_max;
      document.getElementById("headerPeriod").textContent =
        formatDate(data.fecha_min) + " — " + formatDate(data.fecha_max);
    }
  }

  // ── Chart defaults ──

  Chart.defaults.color = "#8899b4";
  Chart.defaults.borderColor = "#1e3050";
  Chart.defaults.font.family =
    "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  // ── KPIs ──

  async function loadKPIs() {
    var data = await fetchApi("summary");
    document.getElementById("kpiIngresos").textContent = fmt(
      data.total_ingresos || 0,
    );
    document.getElementById("kpiEgresos").textContent = fmt(
      data.total_egresos || 0,
    );
    document.getElementById("kpiUtilidad").textContent = fmt(
      data.total_utilidad || 0,
    );
    var comTotal =
      (data.total_comision_prestamo || 0) + (data.total_comision_cobro || 0);
    document.getElementById("kpiComisiones").textContent = fmt(comTotal);
    document.getElementById("kpiPrestamos").textContent =
      data.total_prestamos_nuevos || 0;
    document.getElementById("kpiPrestamosMontoSub").textContent =
      "Monto: " + fmt(data.monto_prestamos_nuevos || 0);
    document.getElementById("kpiClientes").textContent =
      data.total_clientes || 0;
  }

  // ── Timeline chart ──

  async function loadTimeline() {
    var data = await fetchApi("by_date");
    var labels = data.map(function (d) {
      return formatDate(d.fecha);
    });
    var ingresos = data.map(function (d) {
      return d.ingresos;
    });
    var egresos = data.map(function (d) {
      return d.egresos;
    });

    destroyChart("timeline");
    charts.timeline = new Chart(document.getElementById("chartTimeline"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ingresos",
            data: ingresos,
            backgroundColor: COLORS.green + "cc",
            borderColor: COLORS.green,
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Egresos",
            data: egresos,
            backgroundColor: COLORS.red + "cc",
            borderColor: COLORS.red,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                return fmtShort(v);
              },
            },
            grid: { color: GRID_COLOR },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + fmt(ctx.raw);
              },
            },
          },
        },
      },
    });
  }

  // ── Flujo Neto Diario ──

  async function loadFlujoNeto() {
    var data = await fetchApi("flujo_neto");
    var labels = data.map(function (d) {
      return formatDate(d.fecha);
    });
    var flujo = data.map(function (d) {
      return d.flujo_neto;
    });
    var acum = data.map(function (d) {
      return d.flujo_acumulado;
    });
    var bgColors = flujo.map(function (v) {
      return v >= 0 ? COLORS.green + "cc" : COLORS.red + "cc";
    });
    var borderColors = flujo.map(function (v) {
      return v >= 0 ? COLORS.green : COLORS.red;
    });

    destroyChart("flujoNeto");
    charts.flujoNeto = new Chart(document.getElementById("chartFlujoNeto"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Flujo Neto",
            data: flujo,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 3,
          },
          {
            label: "Acumulado",
            data: acum,
            type: "line",
            borderColor: COLORS.cyan,
            backgroundColor: "transparent",
            borderDash: [5, 3],
            tension: 0.3,
            pointRadius: 2,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: {
            ticks: {
              callback: function (v) {
                return fmtShort(v);
              },
            },
            grid: { color: GRID_COLOR },
          },
          y1: {
            position: "right",
            ticks: {
              callback: function (v) {
                return fmtShort(v);
              },
            },
            grid: { display: false },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + fmt(ctx.raw);
              },
            },
          },
        },
      },
    });
  }

  // ── Transacciones por Día ──

  async function loadTransCount() {
    var data = await fetchApi("transacciones_count");
    var labels = data.map(function (d) {
      return formatDate(d.fecha);
    });
    var counts = data.map(function (d) {
      return d.total;
    });

    destroyChart("transCount");
    charts.transCount = new Chart(document.getElementById("chartTransCount"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Transacciones",
            data: counts,
            borderColor: COLORS.purple,
            backgroundColor: COLORS.purple + "33",
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: COLORS.purple,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: GRID_COLOR },
          },
          x: { grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  // ── Asesor charts ──

  async function loadAsesor() {
    var data = await fetchApi("by_asesor");
    var labels = data.map(function (d) {
      return d.asesor || "(Sin asesor)";
    });
    var ingresos = data.map(function (d) {
      return d.ingresos;
    });
    var utilidad = data.map(function (d) {
      return d.utilidad;
    });

    destroyChart("asesor");
    charts.asesor = new Chart(document.getElementById("chartAsesor"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ingresos",
            data: ingresos,
            backgroundColor: PALETTE.map(function (c) {
              return c + "cc";
            }),
            borderColor: PALETTE,
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: "y",
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                return fmtShort(v);
              },
            },
            grid: { color: GRID_COLOR },
          },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return "Ingresos: " + fmt(ctx.raw);
              },
            },
          },
        },
      },
    });

    destroyChart("asesorUtilidad");
    charts.asesorUtilidad = new Chart(
      document.getElementById("chartAsesorUtilidad"),
      {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Utilidad",
              data: utilidad,
              backgroundColor: PALETTE.map(function (c) {
                return c + "cc";
              }),
              borderColor: PALETTE,
              borderWidth: 1,
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          indexAxis: "y",
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: function (v) {
                  return fmtShort(v);
                },
              },
              grid: { color: GRID_COLOR },
            },
            y: { grid: { display: false } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return "Utilidad: " + fmt(ctx.raw);
                },
              },
            },
          },
        },
      },
    );
  }

  // ── Tipo de concepto ──

  async function loadTipo() {
    var data = await fetchApi("by_tipo");
    var labels = data.map(function (d) {
      return d.tipo_concepto || "(Vacío)";
    });
    var counts = data.map(function (d) {
      return d.transacciones;
    });

    destroyChart("tipo");
    charts.tipo = new Chart(document.getElementById("chartTipo"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: counts,
            backgroundColor: PALETTE.slice(0, labels.length),
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: "55%",
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var total = ctx.dataset.data.reduce(function (a, b) {
                  return a + b;
                }, 0);
                return (
                  ctx.label +
                  ": " +
                  ctx.raw +
                  " (" +
                  ((ctx.raw / total) * 100).toFixed(1) +
                  "%)"
                );
              },
            },
          },
        },
      },
    });
  }

  // ── Medio de pago ──

  async function loadMedio() {
    var data = await fetchApi("by_medio");
    var labels = data.map(function (d) {
      return d.medio_pago || "(Vacío)";
    });
    var ingresos = data.map(function (d) {
      return d.ingresos;
    });

    destroyChart("medio");
    charts.medio = new Chart(document.getElementById("chartMedio"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: ingresos,
            backgroundColor: [COLORS.blue, COLORS.orange, COLORS.purple],
            borderWidth: 0,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: "55%",
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.label + ": " + fmt(ctx.raw);
              },
            },
          },
        },
      },
    });
  }

  // ── Gastos Resumen (doughnut) ──

  async function loadGastosResumen() {
    var data = await fetchApi("gastos_resumen");
    var labels = data.map(function (d) {
      return d.tipo_concepto;
    });
    var montos = data.map(function (d) {
      return d.monto_total;
    });

    destroyChart("gastosResumen");
    charts.gastosResumen = new Chart(
      document.getElementById("chartGastosResumen"),
      {
        type: "doughnut",
        data: {
          labels: labels,
          datasets: [
            {
              data: montos,
              backgroundColor: [
                COLORS.red,
                COLORS.orange,
                COLORS.yellow,
                COLORS.pink,
                COLORS.purple,
              ],
              borderWidth: 0,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          cutout: "55%",
          plugins: {
            legend: { position: "right" },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  var total = ctx.dataset.data.reduce(function (a, b) {
                    return a + b;
                  }, 0);
                  return (
                    ctx.label +
                    ": " +
                    fmt(ctx.raw) +
                    " (" +
                    ((ctx.raw / total) * 100).toFixed(1) +
                    "%)"
                  );
                },
              },
            },
          },
        },
      },
    );
  }

  // ── Préstamos por Asesor ──

  async function loadPrestamosAsesor() {
    var data = await fetchApi("prestamos_by_asesor");
    var labels = data.map(function (d) {
      return d.asesor || "(Sin asesor)";
    });
    var montos = data.map(function (d) {
      return d.monto_total;
    });
    var counts = data.map(function (d) {
      return d.total_prestamos;
    });

    destroyChart("prestamosAsesor");
    charts.prestamosAsesor = new Chart(
      document.getElementById("chartPrestamosAsesor"),
      {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Monto Prestado",
              data: montos,
              backgroundColor: COLORS.purple + "cc",
              borderColor: COLORS.purple,
              borderWidth: 1,
              borderRadius: 6,
              yAxisID: "y",
            },
            {
              label: "Cantidad",
              data: counts,
              type: "line",
              borderColor: COLORS.orange,
              backgroundColor: COLORS.orange + "33",
              pointRadius: 5,
              pointHoverRadius: 8,
              pointBackgroundColor: COLORS.orange,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: "index", intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (v) {
                  return fmtShort(v);
                },
              },
              grid: { color: GRID_COLOR },
            },
            y1: {
              position: "right",
              beginAtZero: true,
              ticks: { stepSize: 1 },
              grid: { display: false },
            },
            x: { grid: { display: false } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label === "Cantidad"
                    ? ctx.dataset.label + ": " + ctx.raw
                    : ctx.dataset.label + ": " + fmt(ctx.raw);
                },
              },
            },
          },
        },
      },
    );
  }

  // ── Top clientes ──

  async function loadTopClientes() {
    var data = await fetchApi("top_clientes");
    var labels = data.map(function (d) {
      return d.cliente.length > 25
        ? d.cliente.substring(0, 25) + "..."
        : d.cliente;
    });
    var valores = data.map(function (d) {
      return d.total_pagado;
    });

    destroyChart("topClientes");
    charts.topClientes = new Chart(
      document.getElementById("chartTopClientes"),
      {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Monto Cobrado",
              data: valores,
              backgroundColor: COLORS.cyan + "cc",
              borderColor: COLORS.cyan,
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          indexAxis: "y",
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: function (v) {
                  return fmtShort(v);
                },
              },
              grid: { color: GRID_COLOR },
            },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: function (items) {
                  return data[items[0].dataIndex].cliente;
                },
                label: function (ctx) {
                  return "Total: " + fmt(ctx.raw);
                },
              },
            },
          },
        },
      },
    );
  }

  // ── Comisiones por asesor ──

  async function loadComisiones() {
    var data = await fetchApi("by_asesor");
    var filtered = data.filter(function (d) {
      return d.asesor;
    });
    var labels = filtered.map(function (d) {
      return d.asesor;
    });
    var comCobro = filtered.map(function (d) {
      return d.comisiones_cobro;
    });
    var comPrest = filtered.map(function (d) {
      return d.comisiones_prestamo;
    });

    destroyChart("comisiones");
    charts.comisiones = new Chart(document.getElementById("chartComisiones"), {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Comisión Cobro",
            data: comCobro,
            backgroundColor: COLORS.yellow + "cc",
            borderColor: COLORS.yellow,
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: "Comisión Préstamo",
            data: comPrest,
            backgroundColor: COLORS.purple + "cc",
            borderColor: COLORS.purple,
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            stacked: true,
            ticks: {
              callback: function (v) {
                return fmtShort(v);
              },
            },
            grid: { color: GRID_COLOR },
          },
          x: { stacked: true, grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + fmt(ctx.raw);
              },
            },
          },
        },
      },
    });
  }

  // ── Utilidad diaria acumulada ──

  async function loadUtilidadDiaria() {
    var data = await fetchApi("by_date");
    var labels = data.map(function (d) {
      return formatDate(d.fecha);
    });
    var utilidad = data.map(function (d) {
      return d.utilidad;
    });
    var acumulado = [],
      sum = 0;
    utilidad.forEach(function (u) {
      sum += u;
      acumulado.push(sum);
    });

    destroyChart("utilidadDiaria");
    charts.utilidadDiaria = new Chart(
      document.getElementById("chartUtilidadDiaria"),
      {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Utilidad Diaria",
              data: utilidad,
              borderColor: COLORS.cyan,
              backgroundColor: COLORS.cyan + "33",
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 6,
            },
            {
              label: "Acumulado",
              data: acumulado,
              borderColor: COLORS.green,
              backgroundColor: "transparent",
              borderDash: [6, 3],
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: "index", intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (v) {
                  return fmtShort(v);
                },
              },
              grid: { color: GRID_COLOR },
            },
            x: { grid: { display: false } },
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  return ctx.dataset.label + ": " + fmt(ctx.raw);
                },
              },
            },
          },
        },
      },
    );
  }

  // ── Tables ──

  async function loadPrestamos() {
    var data = await fetchApi("prestamos");
    var tbody = document.querySelector("#tablePrestamos tbody");
    tbody.innerHTML = "";
    data.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        formatDate(row.fecha) +
        "</td><td>" +
        escapeHtml(row.cliente) +
        "</td><td>" +
        escapeHtml(row.asesor) +
        '</td><td class="val-negative">' +
        fmt(row.monto) +
        "</td><td>" +
        fmt(row.comision_prestamo) +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  async function loadGastos() {
    var data = await fetchApi("gastos_detalle");
    var tbody = document.querySelector("#tableGastos tbody");
    tbody.innerHTML = "";
    data.forEach(function (row) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        formatDate(row.fecha) +
        "</td><td>" +
        escapeHtml(row.concepto) +
        "</td><td>" +
        escapeHtml(row.tipo_concepto) +
        '</td><td class="val-negative">' +
        fmt(row.monto) +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  async function loadTransactions(page) {
    page = page || 1;
    currentPage = page;
    var data = await fetchApi("transactions", { page: page, limit: 50 });
    var tbody = document.querySelector("#tableTransactions tbody");
    tbody.innerHTML = "";
    if (data.data) {
      data.data.forEach(function (row) {
        var valClass = row.valor >= 0 ? "val-positive" : "val-negative";
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td>" +
          formatDate(row.fecha) +
          "</td><td>" +
          escapeHtml(row.asesor || "-") +
          "</td><td>" +
          escapeHtml(row.tipo_concepto) +
          "</td><td>" +
          escapeHtml(row.cliente) +
          '</td><td class="' +
          valClass +
          '">' +
          fmt(row.valor) +
          "</td><td>" +
          fmt(row.utilidad) +
          "</td><td>" +
          fmt(row.comision_prestamo) +
          "</td><td>" +
          fmt(row.total_cc) +
          "</td><td>" +
          escapeHtml(row.medio_pago || "-") +
          "</td><td>" +
          escapeHtml(row.mora || "No") +
          "</td>";
        tbody.appendChild(tr);
      });
    }
    // Pagination
    var pagDiv = document.getElementById("pagination");
    pagDiv.innerHTML = "";
    if (data.pages > 1) {
      for (var i = 1; i <= data.pages; i++) {
        var btn = document.createElement("button");
        btn.textContent = i;
        if (i === data.page) btn.className = "active";
        btn.dataset.page = i;
        btn.addEventListener("click", function () {
          loadTransactions(parseInt(this.dataset.page));
        });
        pagDiv.appendChild(btn);
      }
    }
  }

  // ── Upload ──

  function excelToDate(serial) {
    if (typeof serial !== "number") return null;
    return new Date((serial - 25569) * 86400 * 1000)
      .toISOString()
      .split("T")[0];
  }

  function extractConceptType(concepto) {
    if (!concepto) return { tipo: "", cliente: "" };
    var c = concepto.trim();
    if (c.indexOf("Pago de cuota ") === 0)
      return {
        tipo: "Pago de cuota",
        cliente: c.replace("Pago de cuota ", ""),
      };
    if (c.indexOf("Abona parcial ") === 0)
      return {
        tipo: "Abona parcial",
        cliente: c.replace("Abona parcial ", ""),
      };
    if (c.indexOf("Nuevo prestamo-") === 0)
      return {
        tipo: "Nuevo prestamo",
        cliente: c.replace("Nuevo prestamo-", ""),
      };
    if (c.indexOf("SUELDO ") === 0)
      return { tipo: "Sueldo", cliente: c.replace("SUELDO ", "") };
    if (c.indexOf("GASTO SOFOM") === 0) return { tipo: "Gasto", cliente: c };
    if (c.indexOf("GASTO C..018 ") === 0)
      return {
        tipo: "Gasto comision",
        cliente: c.replace("GASTO C..018 ", ""),
      };
    if (c.indexOf("GASTO C.C.") === 0)
      return {
        tipo: "Gasto comision",
        cliente: c.replace(/^GASTO C\.C\.?\s*/, ""),
      };
    if (c.indexOf("GASTO ") === 0)
      return { tipo: "Gasto", cliente: c.replace("GASTO ", "") };
    return { tipo: "Otro", cliente: c };
  }

  function parseExcelFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = new Uint8Array(e.target.result);
          var wb = XLSX.read(data, { type: "array" });
          var ws = wb.Sheets[wb.SheetNames[0]];
          var jsonRows = XLSX.utils.sheet_to_json(ws, { defval: null });

          // Find where MORA section starts
          var moraStart = jsonRows.length;
          for (var mi = 0; mi < jsonRows.length; mi++) {
            if ((jsonRows[mi].Asesor || "").toString().trim() === "MORA") {
              moraStart = mi;
              break;
            }
          }

          var transactions = [];
          for (var i = 0; i < moraStart; i++) {
            var row = jsonRows[i];
            if (typeof row.Valor === "string" || (!row.Concepto && !row.Asesor))
              continue;
            var fecha = excelToDate(row.Fecha);
            if (!fecha) continue;
            var parsed = extractConceptType(row.Concepto || "");
            var asesor = (row.Asesor || "").trim();
            if (asesor === "MAROSC") asesor = "MARCOSC";
            transactions.push({
              asesor: asesor,
              fecha: fecha,
              concepto: row.Concepto || "",
              tipo_concepto: parsed.tipo,
              cliente: parsed.cliente,
              valor: typeof row.Valor === "number" ? row.Valor : 0,
              utilidad: typeof row.Utilidad === "number" ? row.Utilidad : 0,
              comision_prestamo:
                typeof row["Comision prestamo"] === "number"
                  ? row["Comision prestamo"]
                  : 0,
              comision_cobro:
                typeof row["Comision cobro"] === "number"
                  ? row["Comision cobro"]
                  : 0,
              total_cc:
                typeof row["Total CC"] === "number" ? row["Total CC"] : 0,
              medio_pago: (row["Medio pago"] || "").trim(),
              mora: "No",
            });
          }

          // Parse MORA section
          if (moraStart < jsonRows.length) {
            for (var m = moraStart + 2; m < jsonRows.length; m++) {
              var mRow = jsonRows[m];
              if (!mRow.Asesor && !mRow.Concepto) continue;
              if (typeof mRow.Fecha === "string") continue;
              var mFecha = excelToDate(mRow.Fecha);
              if (!mFecha) continue;
              var mCliente = (mRow.Concepto || "").toString().trim();
              if (!mCliente) continue;
              var mAsesor = (mRow.Asesor || "").trim();
              transactions.push({
                asesor: mAsesor,
                fecha: mFecha,
                concepto: "Mora " + mCliente,
                tipo_concepto: "Mora",
                cliente: mCliente,
                valor: typeof mRow.Valor === "number" ? mRow.Valor : 0,
                utilidad: typeof mRow.Utilidad === "number" ? mRow.Utilidad : 0,
                comision_prestamo:
                  typeof mRow["Comision prestamo"] === "number"
                    ? mRow["Comision prestamo"]
                    : 0,
                comision_cobro: 0,
                total_cc: 0,
                medio_pago: "",
                mora: "S\u00ed",
              });
            }
          }
          resolve(transactions);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () {
        reject(new Error("Error leyendo archivo"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function uploadFile(file) {
    var statusEl = document.getElementById("uploadStatus");
    var statusText = document.getElementById("uploadStatusText");
    statusEl.style.display = "flex";
    statusText.textContent = "Procesando " + file.name + "...";

    try {
      var rows = await parseExcelFile(file);
      if (rows.length === 0) {
        statusText.textContent =
          "No se encontraron transacciones válidas en el archivo.";
        statusEl.querySelector(".material-icons-round").className =
          "material-icons-round";
        statusEl.querySelector(".material-icons-round").textContent = "warning";
        return;
      }
      statusText.textContent = "Subiendo " + rows.length + " transacciones...";

      var resp = await fetch(API + "?action=upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, rows: rows }),
      });
      var result = await resp.json();

      if (result.success) {
        statusEl.querySelector(".material-icons-round").className =
          "material-icons-round";
        statusEl.querySelector(".material-icons-round").textContent =
          "check_circle";
        statusEl.style.background = "rgba(76, 206, 172, 0.12)";
        statusEl.style.color = "#4cceac";
        statusText.textContent =
          result.imported + " transacciones importadas de " + result.filename;
        await loadReports();
        await initFilters();
        await loadAll();
      } else {
        throw new Error(result.error || "Error desconocido");
      }
    } catch (err) {
      statusEl.querySelector(".material-icons-round").className =
        "material-icons-round";
      statusEl.querySelector(".material-icons-round").textContent = "error";
      statusEl.style.background = "rgba(255, 107, 107, 0.12)";
      statusEl.style.color = "#ff6b6b";
      statusText.textContent = "Error: " + err.message;
    }
  }

  async function loadReports() {
    var data = await fetchApi("reportes");
    var body = document.getElementById("reportsListBody");
    body.innerHTML = "";
    if (!data.length) {
      body.innerHTML =
        '<p style="font-size:0.85rem;color:#8899b4;">No hay reportes cargados.</p>';
      return;
    }
    data.forEach(function (r) {
      var div = document.createElement("div");
      div.className = "report-item";
      div.innerHTML =
        '<div class="report-item-info">' +
        '<span class="material-icons-round">description</span>' +
        '<div><span class="report-item-name">' +
        escapeHtml(r.reporte) +
        "</span><br>" +
        '<span class="report-item-meta">' +
        r.transacciones +
        " transacciones · " +
        formatDate(r.fecha_min) +
        " — " +
        formatDate(r.fecha_max) +
        "</span></div>" +
        "</div>" +
        '<button class="btn-delete" data-report="' +
        escapeHtml(r.reporte) +
        '">' +
        '<span class="material-icons-round">delete</span> Eliminar' +
        "</button>";
      body.appendChild(div);
    });
    body.querySelectorAll(".btn-delete").forEach(function (btn) {
      btn.addEventListener("click", function () {
        deleteReport(this.dataset.report);
      });
    });
  }

  async function deleteReport(filename) {
    if (
      !confirm(
        '¿Eliminar el reporte "' + filename + '" y todas sus transacciones?',
      )
    )
      return;
    var resp = await fetch(API + "?action=delete_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: filename }),
    });
    var result = await resp.json();
    if (result.success) {
      await loadReports();
      await initFilters();
      await loadAll();
    }
  }

  function initUpload() {
    var panel = document.getElementById("uploadPanel");
    var area = document.getElementById("uploadArea");
    var fileInput = document.getElementById("fileInput");
    var toggleBtn = document.getElementById("btnUploadToggle");

    toggleBtn.addEventListener("click", function () {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });

    area.addEventListener("click", function () {
      fileInput.click();
    });

    area.addEventListener("dragover", function (e) {
      e.preventDefault();
      area.classList.add("drag-over");
    });
    area.addEventListener("dragleave", function () {
      area.classList.remove("drag-over");
    });
    area.addEventListener("drop", function (e) {
      e.preventDefault();
      area.classList.remove("drag-over");
      var files = e.dataTransfer.files;
      if (files.length && /\.(xlsx|xls)$/i.test(files[0].name)) {
        uploadFile(files[0]);
      }
    });

    fileInput.addEventListener("change", function () {
      if (fileInput.files.length) {
        uploadFile(fileInput.files[0]);
        fileInput.value = "";
      }
    });
  }

  // ── Load all ──

  async function loadAll() {
    await loadKPIs();
    loadTimeline();
    loadFlujoNeto();
    loadTransCount();
    loadAsesor();
    loadTipo();
    loadMedio();
    loadGastosResumen();
    loadPrestamosAsesor();
    loadTopClientes();
    loadComisiones();
    loadUtilidadDiaria();
    loadPrestamos();
    loadGastos();
    loadTransactions(1);
  }

  // ── Events ──

  document.getElementById("btnApply").addEventListener("click", function () {
    loadAll();
  });

  document.getElementById("btnReset").addEventListener("click", function () {
    document.getElementById("filterFechaInicio").value = "";
    document.getElementById("filterFechaFin").value = "";
    document.querySelectorAll(".chip.active").forEach(function (c) {
      c.classList.remove("active");
    });
    initFilters().then(loadAll);
  });

  // ── Init ──

  initUpload();
  loadReports();
  initFilters().then(loadAll);
})();
