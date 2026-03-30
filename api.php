<?php
header('Content-Type: application/json; charset=utf-8');

$dbPath = __DIR__ . '/db/dashboard.db';
$jsonPath = __DIR__ . '/data/transactions.json';

if (!is_dir(__DIR__ . '/db')) {
    mkdir(__DIR__ . '/db', 0755, true);
}
if (!is_dir(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0755, true);
}

function ensureSchema($db) {
    $db->exec('CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asesor TEXT NOT NULL DEFAULT "",
        fecha DATE NOT NULL,
        concepto TEXT NOT NULL DEFAULT "",
        tipo_concepto TEXT NOT NULL DEFAULT "",
        cliente TEXT NOT NULL DEFAULT "",
        valor REAL NOT NULL DEFAULT 0,
        utilidad REAL NOT NULL DEFAULT 0,
        comision_prestamo REAL NOT NULL DEFAULT 0,
        comision_cobro REAL NOT NULL DEFAULT 0,
        total_cc REAL NOT NULL DEFAULT 0,
        medio_pago TEXT NOT NULL DEFAULT "",
        reporte TEXT NOT NULL DEFAULT ""
    )');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_fecha ON transactions(fecha)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_asesor ON transactions(asesor)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_tipo ON transactions(tipo_concepto)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_medio ON transactions(medio_pago)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_reporte ON transactions(reporte)');
}

function importRows($db, $rows, $reporte = '') {
    $stmt = $db->prepare('INSERT INTO transactions 
        (asesor, fecha, concepto, tipo_concepto, cliente, valor, utilidad, comision_prestamo, comision_cobro, total_cc, medio_pago, reporte)
        VALUES (:asesor, :fecha, :concepto, :tipo, :cliente, :valor, :utilidad, :com_prest, :com_cobro, :total_cc, :medio, :reporte)');
    
    $db->exec('BEGIN');
    foreach ($rows as $row) {
        $stmt->bindValue(':asesor', $row['asesor'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':fecha', $row['fecha'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':concepto', $row['concepto'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':tipo', $row['tipo_concepto'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':cliente', $row['cliente'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':valor', $row['valor'] ?? 0, SQLITE3_FLOAT);
        $stmt->bindValue(':utilidad', $row['utilidad'] ?? 0, SQLITE3_FLOAT);
        $stmt->bindValue(':com_prest', $row['comision_prestamo'] ?? 0, SQLITE3_FLOAT);
        $stmt->bindValue(':com_cobro', $row['comision_cobro'] ?? 0, SQLITE3_FLOAT);
        $stmt->bindValue(':total_cc', $row['total_cc'] ?? 0, SQLITE3_FLOAT);
        $stmt->bindValue(':medio', $row['medio_pago'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':reporte', $reporte, SQLITE3_TEXT);
        $stmt->execute();
        $stmt->reset();
    }
    $db->exec('COMMIT');
    return count($rows);
}

function getDb() {
    global $dbPath, $jsonPath;
    
    $needsImport = !file_exists($dbPath);
    $db = new SQLite3($dbPath);
    $db->exec('PRAGMA journal_mode=WAL');
    $db->exec('PRAGMA foreign_keys=ON');
    
    if ($needsImport) {
        ensureSchema($db);
        if (file_exists($jsonPath)) {
            $json = file_get_contents($jsonPath);
            $rows = json_decode($json, true);
            importRows($db, $rows, 'enero26.xlsx');
        }
    }
    
    return $db;
}

function buildWhereClause($params) {
    $conditions = [];
    $bindings = [];
    
    if (!empty($params['fecha_inicio'])) {
        $conditions[] = 'fecha >= :fecha_inicio';
        $bindings[':fecha_inicio'] = $params['fecha_inicio'];
    }
    if (!empty($params['fecha_fin'])) {
        $conditions[] = 'fecha <= :fecha_fin';
        $bindings[':fecha_fin'] = $params['fecha_fin'];
    }
    if (!empty($params['asesor'])) {
        $asesores = explode(',', $params['asesor']);
        $placeholders = [];
        foreach ($asesores as $i => $a) {
            $key = ':asesor_' . $i;
            $placeholders[] = $key;
            $bindings[$key] = trim($a);
        }
        $conditions[] = 'asesor IN (' . implode(',', $placeholders) . ')';
    }
    if (!empty($params['tipo'])) {
        $tipos = explode(',', $params['tipo']);
        $placeholders = [];
        foreach ($tipos as $i => $t) {
            $key = ':tipo_' . $i;
            $placeholders[] = $key;
            $bindings[$key] = trim($t);
        }
        $conditions[] = 'tipo_concepto IN (' . implode(',', $placeholders) . ')';
    }
    if (!empty($params['medio'])) {
        $medios = explode(',', $params['medio']);
        $placeholders = [];
        foreach ($medios as $i => $m) {
            $key = ':medio_' . $i;
            $placeholders[] = $key;
            $bindings[$key] = trim($m);
        }
        $conditions[] = 'medio_pago IN (' . implode(',', $placeholders) . ')';
    }
    
    return [$conditions, $bindings];
}

function buildWhere($conditions, $extraConditions = []) {
    $all = array_merge($conditions, $extraConditions);
    return count($all) > 0 ? 'WHERE ' . implode(' AND ', $all) : '';
}

function bindParams($stmt, $bindings) {
    foreach ($bindings as $key => $val) {
        $stmt->bindValue($key, $val, SQLITE3_TEXT);
    }
}

$db = getDb();
$action = $_GET['action'] ?? 'summary';
$params = $_GET;

[$conditions, $bindings] = buildWhereClause($params);
$where = buildWhere($conditions);

switch ($action) {
    case 'summary':
        // KPI totals
        $sql = "SELECT 
            COUNT(*) as total_transacciones,
            SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) as total_ingresos,
            SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END) as total_egresos,
            SUM(utilidad) as total_utilidad,
            SUM(comision_prestamo) as total_comision_prestamo,
            SUM(total_cc) as total_comision_cobro,
            COUNT(DISTINCT CASE WHEN cliente != '' THEN cliente END) as total_clientes,
            COUNT(DISTINCT CASE WHEN tipo_concepto = 'Nuevo prestamo' THEN id END) as total_prestamos_nuevos,
            SUM(CASE WHEN tipo_concepto = 'Nuevo prestamo' THEN ABS(valor) ELSE 0 END) as monto_prestamos_nuevos
            FROM transactions $where";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        echo json_encode($result->fetchArray(SQLITE3_ASSOC));
        break;

    case 'by_date':
        $sql = "SELECT fecha,
            SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) as ingresos,
            SUM(CASE WHEN valor < 0 THEN ABS(valor) ELSE 0 END) as egresos,
            SUM(utilidad) as utilidad,
            SUM(total_cc) as comisiones,
            COUNT(*) as transacciones
            FROM transactions $where
            GROUP BY fecha ORDER BY fecha";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'by_asesor':
        $sql = "SELECT asesor,
            SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) as ingresos,
            SUM(utilidad) as utilidad,
            SUM(total_cc) as comisiones_cobro,
            SUM(comision_prestamo) as comisiones_prestamo,
            COUNT(*) as transacciones,
            COUNT(DISTINCT cliente) as clientes
            FROM transactions $where
            GROUP BY asesor ORDER BY ingresos DESC";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'by_tipo':
        $sql = "SELECT tipo_concepto,
            SUM(valor) as valor_total,
            SUM(utilidad) as utilidad,
            COUNT(*) as transacciones
            FROM transactions $where
            GROUP BY tipo_concepto ORDER BY transacciones DESC";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'by_medio':
        $w = buildWhere($conditions, ["medio_pago != ''"]);
        $sql = "SELECT medio_pago,
            SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) as ingresos,
            COUNT(*) as transacciones
            FROM transactions $w
            GROUP BY medio_pago ORDER BY ingresos DESC";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'top_clientes':
        $w = buildWhere($conditions, ["cliente != ''", "tipo_concepto IN ('Pago de cuota','Abona parcial')"]);
        $sql = "SELECT cliente,
            SUM(CASE WHEN valor > 0 THEN valor ELSE 0 END) as total_pagado,
            SUM(utilidad) as utilidad,
            COUNT(*) as pagos
            FROM transactions $w
            GROUP BY cliente ORDER BY total_pagado DESC LIMIT 15";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'prestamos':
        $w = buildWhere($conditions, ["tipo_concepto = 'Nuevo prestamo'"]);
        $sql = "SELECT fecha, cliente, asesor, ABS(valor) as monto, comision_prestamo
            FROM transactions $w
            ORDER BY fecha";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'transactions':
        $page = max(1, intval($params['page'] ?? 1));
        $limit = min(100, max(10, intval($params['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        
        // Count
        $countSql = "SELECT COUNT(*) as total FROM transactions $where";
        $stmt = $db->prepare($countSql);
        bindParams($stmt, $bindings);
        $total = $stmt->execute()->fetchArray(SQLITE3_ASSOC)['total'];
        
        // Data
        $sql = "SELECT * FROM transactions $where ORDER BY fecha DESC, id DESC LIMIT $limit OFFSET $offset";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        
        echo json_encode(['data' => $rows, 'total' => $total, 'page' => $page, 'pages' => ceil($total / $limit)]);
        break;

    case 'filters':
        $asesores = [];
        $r = $db->query("SELECT DISTINCT asesor FROM transactions WHERE asesor != '' ORDER BY asesor");
        while ($row = $r->fetchArray(SQLITE3_ASSOC)) $asesores[] = $row['asesor'];
        
        $tipos = [];
        $r = $db->query("SELECT DISTINCT tipo_concepto FROM transactions WHERE tipo_concepto != '' ORDER BY tipo_concepto");
        while ($row = $r->fetchArray(SQLITE3_ASSOC)) $tipos[] = $row['tipo_concepto'];
        
        $medios = [];
        $r = $db->query("SELECT DISTINCT medio_pago FROM transactions WHERE medio_pago != '' ORDER BY medio_pago");
        while ($row = $r->fetchArray(SQLITE3_ASSOC)) $medios[] = $row['medio_pago'];
        
        $fechas = $db->querySingle("SELECT MIN(fecha) as min_fecha FROM transactions", true);
        $fechaMax = $db->querySingle("SELECT MAX(fecha) as max_fecha FROM transactions", true);
        
        echo json_encode([
            'asesores' => $asesores,
            'tipos' => $tipos,
            'medios' => $medios,
            'fecha_min' => $fechas['min_fecha'],
            'fecha_max' => $fechaMax['max_fecha']
        ]);
        break;

    case 'gastos_detalle':
        $w = buildWhere($conditions, ["tipo_concepto IN ('Gasto','Gasto comision','Sueldo')"]);
        $sql = "SELECT fecha, concepto, tipo_concepto, cliente, ABS(valor) as monto
            FROM transactions $w
            ORDER BY fecha";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'prestamos_by_asesor':
        $w = buildWhere($conditions, ["tipo_concepto = 'Nuevo prestamo'"]);
        $sql = "SELECT asesor, COUNT(*) as total_prestamos, SUM(ABS(valor)) as monto_total
            FROM transactions $w
            GROUP BY asesor ORDER BY monto_total DESC";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'gastos_resumen':
        $w = buildWhere($conditions, ["valor < 0"]);
        $sql = "SELECT tipo_concepto, SUM(ABS(valor)) as monto_total, COUNT(*) as transacciones
            FROM transactions $w
            GROUP BY tipo_concepto ORDER BY monto_total DESC";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'flujo_neto':
        $sql = "SELECT fecha,
            SUM(valor) as flujo_neto
            FROM transactions $where
            GROUP BY fecha ORDER BY fecha";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        $acum = 0;
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $acum += $row['flujo_neto'];
            $row['flujo_acumulado'] = $acum;
            $rows[] = $row;
        }
        echo json_encode($rows);
        break;

    case 'transacciones_count':
        $sql = "SELECT fecha, COUNT(*) as total
            FROM transactions $where
            GROUP BY fecha ORDER BY fecha";
        $stmt = $db->prepare($sql);
        bindParams($stmt, $bindings);
        $result = $stmt->execute();
        $rows = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'reportes':
        $rows = [];
        $r = $db->query("SELECT reporte, COUNT(*) as transacciones, MIN(fecha) as fecha_min, MAX(fecha) as fecha_max
            FROM transactions WHERE reporte != '' GROUP BY reporte ORDER BY fecha_min DESC");
        while ($row = $r->fetchArray(SQLITE3_ASSOC)) $rows[] = $row;
        echo json_encode($rows);
        break;

    case 'upload':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
            break;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['rows']) || empty($input['filename'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos inválidos']);
            break;
        }
        $filename = basename($input['filename']);
        // Check if report already exists
        $checkStmt = $db->prepare("SELECT COUNT(*) as c FROM transactions WHERE reporte = :r");
        $checkStmt->bindValue(':r', $filename, SQLITE3_TEXT);
        $existing = $checkStmt->execute()->fetchArray(SQLITE3_ASSOC)['c'];
        if ($existing > 0) {
            // Delete old data for this report
            $delStmt = $db->prepare("DELETE FROM transactions WHERE reporte = :r");
            $delStmt->bindValue(':r', $filename, SQLITE3_TEXT);
            $delStmt->execute();
        }
        ensureSchema($db);
        $count = importRows($db, $input['rows'], $filename);
        echo json_encode(['success' => true, 'imported' => $count, 'filename' => $filename]);
        break;

    case 'delete_report':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
            break;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['filename'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Nombre de archivo requerido']);
            break;
        }
        $filename = basename($input['filename']);
        $delStmt = $db->prepare("DELETE FROM transactions WHERE reporte = :r");
        $delStmt->bindValue(':r', $filename, SQLITE3_TEXT);
        $delStmt->execute();
        echo json_encode(['success' => true, 'deleted' => $db->changes()]);
        break;

    default:
        echo json_encode(['error' => 'Acción no válida']);
}

$db->close();
