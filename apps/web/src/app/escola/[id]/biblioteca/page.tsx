 

export default function BibliotecaEmConstrucao() {
    return (
        <div style={{
            minHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center"
        }}>
            <img
                src="/construction.svg"
                alt="Página em construção"
                style={{ width: 120, marginBottom: 24 }}
            />
            <h1>Página em construção</h1>
            <p>Em breve você poderá acessar a biblioteca desta escola.</p>
        </div>
    );
}
