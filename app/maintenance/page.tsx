export default function Maintenance() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Maintenance – Portail RIUSC</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: sans-serif; background: #f0f4f8; display: flex;
                 justify-content: center; align-items: center; min-height: 100vh; }
          .box { background: white; border-radius: 12px; padding: 48px 40px;
                 max-width: 480px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          h1 { color: #1a202c; font-size: 1.5rem; margin: 16px 0 12px; }
          p { color: #4a5568; line-height: 1.6; }
          .badge { display: inline-block; background: #fff3cd; color: #856404;
                   border: 1px solid #ffc107; border-radius: 99px;
                   padding: 4px 14px; font-size: 0.82rem; font-weight: 600; margin-top: 20px; }
        `}</style>
      </head>
      <body>
        <div className="box">
          <div style={{fontSize: '3rem'}}>🔧</div>
          <h1>Maintenance en cours</h1>
          <p>Le portail des bénévoles est temporairement inaccessible.<br /><br />
          Nous travaillons à rétablir le service le plus rapidement possible.</p>
          <div className="badge">⏱ Retour prévu sous peu</div>
        </div>
      </body>
    </html>
  )
}