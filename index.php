<?php require_once __DIR__ . '/auth.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Financiero</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons+Round">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
</head>
<body>
    <div class="dashboard">
        <!-- Header -->
        <header class="header">
            <div class="header-left">
                <span class="material-icons-round header-logo">assessment</span>
                <h1>Dashboard Financiero</h1>
            </div>
            <div class="header-right">
                <span class="header-period" id="headerPeriod"></span>
                <button class="btn btn-upload" id="btnUploadToggle">
                    <span class="material-icons-round">upload_file</span>
                    Subir Reporte
                </button>
                <a href="auth.php?action=logout" class="btn btn-secondary btn-logout">
                    <span class="material-icons-round">logout</span>
                </a>
            </div>
        </header>

        <!-- Upload Panel -->
        <section class="upload-panel" id="uploadPanel" style="display:none;">
            <div class="upload-area" id="uploadArea">
                <span class="material-icons-round upload-icon">cloud_upload</span>
                <p class="upload-title">Arrastra un archivo Excel aquí</p>
                <p class="upload-sub">o haz clic para seleccionar (.xlsx, .xls)</p>
                <input type="file" id="fileInput" accept=".xlsx,.xls" style="display:none">
            </div>
            <div class="upload-status" id="uploadStatus" style="display:none;">
                <span class="material-icons-round spinning">sync</span>
                <span id="uploadStatusText">Procesando...</span>
            </div>
            <div class="reports-list" id="reportsList">
                <h4><span class="material-icons-round">folder_open</span> Reportes cargados</h4>
                <div id="reportsListBody"></div>
            </div>
        </section>

        <!-- Filters -->
        <section class="filters-bar" id="filtersBar">
            <div class="filter-group">
                <label>Fecha Inicio</label>
                <input type="date" id="filterFechaInicio">
            </div>
            <div class="filter-group">
                <label>Fecha Fin</label>
                <input type="date" id="filterFechaFin">
            </div>
            <div class="filter-group">
                <label>Asesor</label>
                <div class="multi-select" id="filterAsesor"></div>
            </div>
            <div class="filter-group">
                <label>Tipo</label>
                <div class="multi-select" id="filterTipo"></div>
            </div>
            <div class="filter-group">
                <label>Medio de Pago</label>
                <div class="multi-select" id="filterMedio"></div>
            </div>
            <div class="filter-group">
                <label>Mora</label>
                <div class="multi-select" id="filterMora"></div>
            </div>
            <div class="filter-actions">
                <button class="btn btn-primary" id="btnApply">
                    <span class="material-icons-round">filter_alt</span>
                    Aplicar
                </button>
                <button class="btn btn-secondary" id="btnReset">
                    <span class="material-icons-round">restart_alt</span>
                    Limpiar
                </button>
            </div>
        </section>

        <!-- KPI Cards -->
        <section class="kpi-row">
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-green"><span class="material-icons-round">trending_up</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Ingresos (Cobros)</span>
                    <span class="kpi-value color-green" id="kpiIngresos">$0</span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-red"><span class="material-icons-round">trending_down</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Egresos Totales</span>
                    <span class="kpi-value color-red" id="kpiEgresos">$0</span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-cyan"><span class="material-icons-round">show_chart</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Utilidad Total</span>
                    <span class="kpi-value color-cyan" id="kpiUtilidad">$0</span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-yellow"><span class="material-icons-round">sell</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Comisiones Totales</span>
                    <span class="kpi-value color-yellow" id="kpiComisiones">$0</span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-purple"><span class="material-icons-round">account_balance</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Préstamos Nuevos</span>
                    <span class="kpi-value color-purple" id="kpiPrestamos">0</span>
                    <span class="kpi-sub" id="kpiPrestamosMontoSub"></span>
                </div>
            </div>
            <div class="kpi-card">
                <div class="kpi-icon-wrap kpi-bg-orange"><span class="material-icons-round">groups</span></div>
                <div class="kpi-content">
                    <span class="kpi-label">Clientes Únicos</span>
                    <span class="kpi-value color-orange" id="kpiClientes">0</span>
                </div>
            </div>
        </section>

        <!-- Row 1: Timeline -->
        <section class="charts-row">
            <div class="chart-card wide">
                <div class="chart-header"><h3><span class="material-icons-round">bar_chart</span> Ingresos y Egresos Diarios</h3></div>
                <canvas id="chartTimeline"></canvas>
            </div>
        </section>

        <!-- Row 2: Flujo Neto + Transacciones diarias -->
        <section class="charts-row">
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">swap_vert</span> Flujo Neto Diario</h3></div>
                <canvas id="chartFlujoNeto"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">receipt_long</span> Transacciones por Día</h3></div>
                <canvas id="chartTransCount"></canvas>
            </div>
        </section>

        <!-- Row 3: Asesor -->
        <section class="charts-row">
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">leaderboard</span> Ingresos por Asesor</h3></div>
                <canvas id="chartAsesor"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">emoji_events</span> Utilidad por Asesor</h3></div>
                <canvas id="chartAsesorUtilidad"></canvas>
            </div>
        </section>

        <!-- Row 4: Pie charts -->
        <section class="charts-row">
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">donut_large</span> Distribución por Tipo</h3></div>
                <canvas id="chartTipo"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">payments</span> Medio de Pago</h3></div>
                <canvas id="chartMedio"></canvas>
            </div>
        </section>

        <!-- Row 5: Gastos + Préstamos -->
        <section class="charts-row">
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">pie_chart</span> Desglose de Egresos</h3></div>
                <canvas id="chartGastosResumen"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">account_balance_wallet</span> Préstamos Otorgados por Asesor</h3></div>
                <canvas id="chartPrestamosAsesor"></canvas>
            </div>
        </section>

        <!-- Row 6: Top clientes + Comisiones -->
        <section class="charts-row">
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">person</span> Top 15 Clientes</h3></div>
                <canvas id="chartTopClientes"></canvas>
            </div>
            <div class="chart-card">
                <div class="chart-header"><h3><span class="material-icons-round">price_check</span> Comisiones por Asesor</h3></div>
                <canvas id="chartComisiones"></canvas>
            </div>
        </section>

        <!-- Row 7: Utilidad acumulada -->
        <section class="charts-row">
            <div class="chart-card wide">
                <div class="chart-header"><h3><span class="material-icons-round">timeline</span> Utilidad Diaria Acumulada</h3></div>
                <canvas id="chartUtilidadDiaria"></canvas>
            </div>
        </section>

        <!-- Préstamos table -->
        <section class="table-section">
            <div class="table-header"><h3><span class="material-icons-round">credit_score</span> Detalle de Préstamos Nuevos</h3></div>
            <div class="table-wrap">
                <table id="tablePrestamos">
                    <thead><tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Monto</th><th>Comisión</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </section>

        <!-- Gastos table -->
        <section class="table-section">
            <div class="table-header"><h3><span class="material-icons-round">money_off</span> Detalle de Gastos y Sueldos</h3></div>
            <div class="table-wrap">
                <table id="tableGastos">
                    <thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </section>

        <!-- All transactions -->
        <section class="table-section">
            <div class="table-header"><h3><span class="material-icons-round">list_alt</span> Todas las Transacciones</h3></div>
            <div class="table-wrap">
                <table id="tableTransactions">
                    <thead><tr><th>Fecha</th><th>Asesor</th><th>Tipo</th><th>Cliente</th><th>Valor</th><th>Utilidad</th><th>Com. Préstamo</th><th>Com. Cobro</th><th>Medio Pago</th><th>Mora</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="pagination" id="pagination"></div>
        </section>
    </div>

    <script src="js/dashboard.js"></script>
</body>
</html>
