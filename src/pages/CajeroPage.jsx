import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// fecha actual
const TODAY = new Date().toISOString().split('T')[0];

export default function CajeroPage({ session, profile }) {
  const [flavors, setFlavors] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [cajero, setCajero] = useState('');
  const [fecha, setFecha] = useState(TODAY);
  const [pizzas, setPizzas] = useState([
    { flavor: '', reason: '', turno: 'AM', cantidad: 1 },
  ]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [records, setRecords] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // cargar catálogos
  useEffect(() => {
    const loadData = async () => {
      const { data: f } = await supabase.from('flavors').select('id, name').eq('is_active', true);
      const { data: r } = await supabase.from('cancellation_reasons').select('id, reason').eq('is_active', true);
      setFlavors(f || []);
      setReasons(r || []);
      loadRecords();
    };
    loadData();
  }, []);

  // cargar registros del cajero actual
  const loadRecords = async () => {
    const { data } = await supabase
      .from('cancellation_records')
      .select('id, date, total_cancelled')
      .eq('created_by', session.user.id)
      .order('date', { ascending: false })
      .limit(5);
    setRecords(data || []);
  };

  const handleAddPizza = () => {
    setPizzas([...pizzas, { flavor: '', reason: '', turno: 'AM', cantidad: 1 }]);
  };

  const handleRemovePizza = (index) => {
    setPizzas(pizzas.filter((_, i) => i !== index));
  };

  const handleChange = (index, field, value) => {
    const updated = [...pizzas];
    updated[index][field] = value;
    setPizzas(updated);
  };

  const handleSave = async () => {
    if (!cajero.trim()) {
      setMsg('⚠️ Debe ingresar el nombre del cajero');
      return;
    }

    if (!fecha) {
      setMsg('⚠️ Debe seleccionar la fecha');
      return;
    }

    if (pizzas.some(p => !p.flavor || !p.reason || !p.cantidad)) {
      setMsg('⚠️ Complete todos los campos de las pizzas');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const { data: record, error: err1 } = await supabase
        .from('cancellation_records')
        .insert([
          {
            branch_id: profile.branch_id,
            cashier_name: cajero,
            date: fecha,
            total_cancelled: pizzas.length,
            created_by: session.user.id,
          },
        ])
        .select()
        .single();

      if (err1) throw err1;

      const pizzasData = pizzas.map(p => ({
        record_id: record.id,
        flavor_id: p.flavor,
        reason_id: p.reason,
        turno: p.turno,
        cantidad: p.cantidad,
      }));

      const { error: err2 } = await supabase.from('cancelled_pizzas').insert(pizzasData);
      if (err2) throw err2;

      setMsg('✅ Registro guardado correctamente');
      setPizzas([{ flavor: '', reason: '', turno: 'AM', cantidad: 1 }]);
      setCajero('');
      setFecha(TODAY);
      loadRecords();
    } catch (e) {
      console.error(e);
      setMsg('❌ Error al guardar registro');
    } finally {
      setLoading(false);
    }
  };

  // cargar detalle de un registro
  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    const { data } = await supabase
      .from('cancelled_pizzas')
      .select('turno, cantidad, flavor_id(name), reason_id(reason)')
      .eq('record_id', id);
    setExpandedId({ id, data });
  };

  return (
    <div style={{ padding: 24, backgroundColor: '#0c0c0c', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#f44336', textAlign: 'center' }}>🍕 Pizza Río</h1>
      <h3 style={{ textAlign: 'center', marginBottom: 30 }}>Registro de Cancelaciones</h3>

      {/* DATOS DEL TURNO */}
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          boxShadow: '0 0 12px rgba(255,0,0,0.1)',
        }}
      >
        <h4 style={{ marginBottom: 10, color: '#ffcc00' }}>Datos del Turno</h4>
        <p style={{ marginBottom: 10 }}>
            <p><b>Sucursal:</b> {profile.branches?.name || '—'}</p>
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label>Nombre del cajero</label>
            <input
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #333',
                background: '#111',
                color: '#fff',
              }}
              type="text"
              value={cajero}
              onChange={(e) => setCajero(e.target.value)}
              placeholder="Ingrese su nombre"
            />
          </div>

          <div style={{ width: 200 }}>
            <label>Fecha</label>
            <input
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #333',
                background: '#111',
                color: '#fff',
              }}
              type="date"
              value={fecha}
              max={TODAY}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* PIZZAS CANCELADAS */}
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          boxShadow: '0 0 12px rgba(255,0,0,0.1)',
        }}
      >
        <h4 style={{ marginBottom: 10, color: '#ffcc00' }}>Pizzas Canceladas</h4>
        {pizzas.map((p, i) => (
          <div
            key={i}
            style={{
              border: '1px solid #333',
              padding: 10,
              borderRadius: 12,
              marginBottom: 10,
              background: '#111',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <select
                value={p.flavor}
                onChange={(e) => handleChange(i, 'flavor', e.target.value)}
                style={{ flex: 1, minWidth: 130, padding: 6, borderRadius: 6, background: '#000', color: '#fff' }}
              >
                <option value="">Sabor</option>
                {flavors.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>

              <select
                value={p.reason}
                onChange={(e) => handleChange(i, 'reason', e.target.value)}
                style={{ flex: 1, minWidth: 150, padding: 6, borderRadius: 6, background: '#000', color: '#fff' }}
              >
                <option value="">Motivo</option>
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.reason}</option>
                ))}
              </select>

              <select
                value={p.turno}
                onChange={(e) => handleChange(i, 'turno', e.target.value)}
                style={{ width: 100, padding: 6, borderRadius: 6, background: '#000', color: '#fff' }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>

              <input
                type="number"
                value={p.cantidad}
                min="1"
                onChange={(e) =>
                  handleChange(i, 'cantidad', parseInt(e.target.value || '1', 10))
                }
                style={{ width: 80, padding: 6, borderRadius: 6, background: '#000', color: '#fff' }}
              />

              {pizzas.length > 1 && (
                <button
                  onClick={() => handleRemovePizza(i)}
                  style={{
                    background: '#b71c1c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={handleAddPizza}
          style={{
            marginTop: 10,
            background: 'transparent',
            border: '1px dashed #ffcc00',
            color: '#ffcc00',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          + Agregar otra pizza
        </button>

        <div style={{ marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              width: '100%',
              padding: 10,
              border: 'none',
              borderRadius: 10,
              background: '#e11',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Guardando...' : 'Guardar Registro'}
          </button>
        </div>

        {msg && <p style={{ marginTop: 10, color: '#ffcc00' }}>{msg}</p>}
      </div>

      {/* REGISTROS RECIENTES */}
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 0 12px rgba(255,0,0,0.1)',
        }}
      >
        <h4 style={{ marginBottom: 10, color: '#ffcc00' }}>Registros recientes</h4>
        {records.length === 0 ? (
          <p>No hay registros aún</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#ccc' }}>
                <th style={{ padding: '6px 0' }}>Fecha</th>
                <th>Total</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: '6px 0' }}>{r.date}</td>
                  <td>{r.total_cancelled}</td>
                  <td>
                    <button
                      onClick={() => toggleExpand(r.id)}
                      style={{
                        background: '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '4px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      {expandedId?.id === r.id ? 'Ocultar' : 'Ver'}
                    </button>
                    {expandedId?.id === r.id && (
                      <div style={{ marginTop: 8, paddingLeft: 10 }}>
                        {expandedId.data.map((p, i) => (
                          <p key={i} style={{ fontSize: 14, color: '#ccc' }}>
                            🍕 {p.flavor_id.name} — {p.reason_id.reason} — {p.turno} — {p.cantidad}u
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
