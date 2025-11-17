import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Swal from 'sweetalert2';

// 🔹 NUEVO: imports para fecha y DatePicker
import { format } from 'date-fns-tz';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// 🔹 NUEVO: zona horaria Bolivia
const TIME_ZONE = 'America/La_Paz';

// 🔹 NUEVO: helper para mostrar fecha yyyy-MM-dd -> dd-MM-yyyy
const formatDisplayDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const dateObj = new Date(`${dateString}T00:00:00`);
    return format(dateObj, 'dd-MM-yyyy', { timeZone: TIME_ZONE });
  } catch {
    return dateString;
  }
};

// 🔹 NUEVO: helper para convertir Date -> yyyy-MM-dd
const toYYYYMMDD = (dateObj) => {
  if (!dateObj) return '';
  return format(dateObj, 'yyyy-MM-dd', { timeZone: TIME_ZONE });
};

export default function SupervisorPage({ profile }) {
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    branchId: 'all',
    // 🔹 CAMBIO: de '' a null para trabajar con DatePicker
    date: null,
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  // detalle seleccionado
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailPizzas, setDetailPizzas] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [llegaron, setLlegaron] = useState('');
  const [savingValidation, setSavingValidation] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadBranches();
    loadRecords();
  }, []);

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Cerrar sesión',
      text: '¿Seguro que deseas salir?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    });
    if (!result.isConfirmed) return;

    await supabase.auth.signOut();
    await Swal.fire({
      icon: 'success',
      title: 'Sesión cerrada',
      timer: 1200,
      showConfirmButton: false,
    });
    window.location.href = '/login';
  };

  const loadBranches = async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error cargando sucursales', error);
      return;
    }
    setBranches(data || []);
  };

  const loadRecords = async () => {
    setLoading(true);
    setSelectedRecord(null);
    setDetailPizzas([]);
    setMsg('');

    let query = supabase
      .from('cancellation_records')
      .select(
        `
        id,
        date,
        turno,
        total_cancelled,
        total_sent,
        cashier_name,
        branch_id,
        branches ( name )
      `
      )
      .order('date', { ascending: false });

    if (filters.branchId !== 'all') {
      query = query.eq('branch_id', filters.branchId);
    }

    // 🔹 CAMBIO: ahora filters.date es un Date, convertir a yyyy-MM-dd
    if (filters.date) {
      const formattedDate = toYYYYMMDD(filters.date);
      query = query.eq('date', formattedDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error cargando registros', error);
      setRecords([]);
    } else {
      setRecords(data || []);
    }

    setLoading(false);
  };

  const totals = useMemo(() => {
    const totalRegistros = records.length;
    const totalCanceladas = records.reduce(
      (acc, r) => acc + (r.total_cancelled || 0),
      0
    );
    const totalEnviadas = records.reduce(
      (acc, r) => acc + (r.total_sent || 0),
      0
    );
    return { totalRegistros, totalCanceladas, totalEnviadas };
  }, [records]);

  const handleClearFilters = () => {
    // 🔹 CAMBIO: resetear date a null (para DatePicker)
    setFilters({ branchId: 'all', date: null });
    loadRecords();
  };

  const openDetail = async (record) => {
    if (selectedRecord && selectedRecord.id === record.id) {
      setSelectedRecord(null);
      setDetailPizzas([]);
      setLlegaron('');
      setMsg('');
      return;
    }

    setDetailLoading(true);
    setSelectedRecord(record);
    setDetailPizzas([]);
    setMsg('');

    const { data, error } = await supabase
      .from('cancelled_pizzas')
      .select(
        `
        id,
        cantidad,
        flavors ( name ),
        cancellation_reasons ( reason )
      `
      )
      .eq('record_id', record.id);

    if (error) {
      console.error('Error cargando detalle', error);
      setDetailPizzas([]);
    } else {
      setDetailPizzas(data || []);
    }

    setLlegaron(record.total_sent ?? '');
    setDetailLoading(false);
  };

  const totalPizzasDetalle = useMemo(
    () => detailPizzas.reduce((acc, p) => acc + (p.cantidad || 0), 0),
    [detailPizzas]
  );

  const handleSaveValidation = async () => {
    const valor = parseInt(llegaron, 10);
    if (Number.isNaN(valor) || valor < 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Valor inválido',
        text: 'Por favor, ingrese un número válido de pizzas que llegaron a central.',
      });
      return;
    }

    setSavingValidation(true);
    setMsg('');

    try {
      const { data, error } = await supabase
        .from('cancellation_records')
        .update({ total_sent: valor })
        .eq('id', selectedRecord.id)
        .select();

      if (error) {
        console.error('Error guardando validación:', error);
        setMsg('❌ Error al guardar la validación');
        setSavingValidation(false);
        return;
      }

      if (!data || data.length === 0) {
        setMsg('⚠️ No se pudo verificar la actualización (revisa políticas RLS)');
        setSavingValidation(false);
        return;
      }

      const updated = data[0];
      setMsg('Validación guardada correctamente');

      // Actualiza tabla y registro seleccionado
      setRecords((prev) =>
        prev.map((r) =>
          r.id === selectedRecord.id ? { ...r, total_sent: updated.total_sent } : r
        )
      );
      setSelectedRecord((prev) =>
        prev ? { ...prev, total_sent: updated.total_sent } : prev
      );

      // Mostrar mensaje de guardado
      await Swal.fire({
        icon: 'success',
        title: 'Validación guardada correctamente',
        text: 'La validación ha sido guardada con éxito.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error('Excepción al guardar:', e);
      setMsg('Error inesperado al guardar');
    } finally {
      setSavingValidation(false);
    }
  };

  const getDiscrepancia = (record) => {
    if (record.total_sent == null) return { label: 'Pendiente', color: '#ffcc00' };
    if (record.total_sent === record.total_cancelled)
      return { label: 'Sin discrepancia', color: '#2ecc71' };

    const diff = record.total_cancelled - record.total_sent;
    if (diff > 0)
      return { label: `Faltan ${diff}`, color: '#e74c3c' };

    return { label: `Sobra ${Math.abs(diff)}`, color: '#e67e22' };
  };

  return (
    <div
      style={{
        padding: 24,
        backgroundColor: '#050505',
        color: '#fff',
        minHeight: '100vh',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* 🔹 Botón Salir */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          onClick={handleLogout}
          style={{
            background: '#b71c1c',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            padding: '6px 12px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          →  Salir
        </button>
      </div>

      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: 24 }}>
        <h1 style={{ color: '#ff3b30', margin: 0 }}>Pizza Río - Supervisor</h1>
        <p style={{ color: '#aaa', marginTop: 4 }}>Vista de Registros</p>
      </header>

      {/* Filtros */}
      <section
        style={{
          background: '#111',
          borderRadius: 16,
          padding: 18,
          marginBottom: 20,
          boxShadow: '0 0 16px rgba(0,0,0,0.6)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 8, color: '#ffcc00' }}>Filtros</h3>
        <p style={{ marginTop: 0, color: '#aaa', fontSize: 14 }}>
          Filtre los registros por sucursal y fecha
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'flex-end',
            marginTop: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ fontSize: 13, color: '#ddd' }}>Sucursal</label>
            <select
              value={filters.branchId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, branchId: e.target.value }))
              }
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #333',
                background: '#000',
                color: '#fff',
              }}
            >
              <option value="all">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* 🔹 CAMBIO: DatePicker en lugar de input type="date" */}
          <div style={{ width: 200 }}>
            <label style={{ fontSize: 13, color: '#ddd' }}>Fecha</label>
            <DatePicker
              selected={filters.date}
              onChange={(date) =>
                setFilters((f) => ({ ...f, date }))
              }
              dateFormat="dd-MM-yyyy"
              isClearable
              placeholderText="Seleccionar fecha..."
              className="mi-datepicker-supervisor"
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={loadRecords}
              style={{
                background: '#ff3b30',
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Aplicar filtros
            </button>
            <button
              onClick={handleClearFilters}
              style={{
                background: 'transparent',
                color: '#ccc',
                border: '1px solid #444',
                borderRadius: 999,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </section>

      {/* Cards resumen */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ background: '#111', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>Total Registros</p>
          <h2 style={{ margin: '6px 0 0', fontSize: 28 }}>{totals.totalRegistros}</h2>
        </div>
        <div style={{ background: '#111', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>Pizzas Canceladas</p>
          <h2 style={{ margin: '6px 0 0', fontSize: 28, color: '#ffcc00' }}>
            {totals.totalCanceladas}
          </h2>
        </div>
        <div style={{ background: '#111', borderRadius: 16, padding: 16, textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#aaa', fontSize: 13 }}>Enviadas a Central</p>
          <h2 style={{ margin: '6px 0 0', fontSize: 28, color: '#4caf50' }}>
            {totals.totalEnviadas}
          </h2>
        </div>
      </section>

      {/* Tabla */}
      <section
        style={{
          background: '#111',
          borderRadius: 16,
          padding: 18,
          boxShadow: '0 0 16px rgba(0,0,0,0.6)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 4, color: '#ffcc00' }}>Registros de Cancelaciones</h3>
        <p style={{ marginTop: 0, color: '#aaa', fontSize: 13 }}>
          Mostrando {records.length} registros
        </p>

        {loading ? (
          <p>Cargando registros...</p>
        ) : records.length === 0 ? (
          <p>No hay registros para los filtros seleccionados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ color: '#ccc' }}>
                  <th style={{ padding: '8px 4px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '8px 4px', textAlign: 'left' }}>Turno</th>
                  <th style={{ padding: '8px 4px', textAlign: 'left' }}>Sucursal</th>
                  <th style={{ padding: '8px 4px', textAlign: 'left' }}>Cajero</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Total Canceladas</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Enviadas a central</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Discrepancia</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center' }}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const disc = getDiscrepancia(r);
                  return (
                    <tr key={r.id}>
                      {/* 🔹 CAMBIO: mostrar fecha formateada */}
                      <td>{formatDisplayDate(r.date)}</td>
                      <td>{r.turno}</td>
                      <td>{r.branches?.name || '—'}</td>
                      <td>{r.cashier_name}</td>
                      <td style={{ textAlign: 'center' }}>{r.total_cancelled}</td>
                      <td style={{ textAlign: 'center' }}>{r.total_sent ?? 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            background: '#222',
                            color: disc.color,
                          }}
                        >
                          {disc.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => openDetail(r)}
                          style={{
                            background:
                              selectedRecord && selectedRecord.id === r.id
                                ? '#ffcc00'
                                : '#ff3b30',
                            color:
                              selectedRecord && selectedRecord.id === r.id
                                ? '#111'
                                : '#fff',
                            border: 'none',
                            borderRadius: 999,
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          {selectedRecord && selectedRecord.id === r.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detalle */}
      {selectedRecord && (
        <section
          style={{
            marginTop: 20,
            background: '#111',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 0 16px rgba(0,0,0,0.6)',
          }}
        >
          <h3 style={{ marginTop: 0, color: '#ffcc00' }}>Detalle del registro</h3>
          <p style={{ margin: 0, color: '#ccc', fontSize: 14 }}>
            <b>Fecha:</b> {formatDisplayDate(selectedRecord.date)} &nbsp;|&nbsp;
            <b>Turno:</b> {selectedRecord.turno} &nbsp;|&nbsp;
            <b>Sucursal:</b> {selectedRecord.branches?.name || '—'} &nbsp;|&nbsp;
            <b>Cajero:</b> {selectedRecord.cashier_name}
          </p>

          {detailLoading ? (
            <p style={{ marginTop: 12 }}>Cargando detalle...</p>
          ) : detailPizzas.length === 0 ? (
            <p style={{ marginTop: 12 }}>No hay pizzas en este registro.</p>
          ) : (
            <>
              <div style={{ marginTop: 16 }}>
                {detailPizzas.map((p) => (
                  <p key={p.id} style={{ margin: '4px 0', color: '#ddd' }}>
                    🍕 {p.flavors?.name || '—'} — {p.cancellation_reasons?.reason || '—'} — {p.cantidad}u
                  </p>
                ))}
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 12,
                  background: '#181818',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <p style={{ margin: 0 }}>
                  <b>Total pizzas reportadas:</b> {totalPizzasDetalle}
                </p>

                {selectedRecord.total_sent > 0 ? (
                  <p style={{ margin: 0, color: '#4caf50' }}>
                     Validación realizada: llegaron {selectedRecord.total_sent} pizzas.
                  </p>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: 13, color: '#ddd' }}>
                        Pizzas que llegaron a central
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={llegaron}
                        onChange={(e) => setLlegaron(e.target.value)}
                        style={{
                          marginLeft: 8,
                          padding: 6,
                          borderRadius: 8,
                          border: '1px solid #333',
                          background: '#000',
                          color: '#fff',
                          width: 100,
                        }}
                      />
                    </div>

                    <button
                      onClick={handleSaveValidation}
                      disabled={savingValidation}
                      style={{
                        background: '#4caf50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 999,
                        padding: '6px 14px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {savingValidation ? 'Guardando...' : 'Guardar validación'}
                    </button>
                  </>
                )}
              </div>

              {msg && <p style={{ marginTop: 10, color: '#ffcc00', fontSize: 13 }}>{msg}</p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
