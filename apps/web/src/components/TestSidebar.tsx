export default function TestSidebar() {
  return (
    <div style={{
      position: 'fixed',
      left: 0,
      top: 0,
      width: '256px',
      height: '100vh',
      background: 'blue',
      color: 'white',
      padding: '20px',
      zIndex: 1000
    }}>
      <h2>SIDEBAR TESTE</h2>
      <p>Funcionando!</p>
    </div>
  )
}