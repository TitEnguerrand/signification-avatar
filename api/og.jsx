import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(165deg, #f7f3ee 0%, #ece5da 40%, #e2d9cc 100%)',
          fontFamily: 'Georgia, serif',
          padding: '60px',
        }}
      >
        <div style={{ fontSize: '18px', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#8b7355', marginBottom: '28px' }}>
          GEOFFROY DE CLISSON
        </div>
        <div style={{ fontSize: '68px', fontWeight: 300, color: '#2c1e10', lineHeight: 1.15 }}>
          La Philosophie
        </div>
        <div style={{ fontSize: '68px', fontWeight: 300, color: '#2c1e10', fontStyle: 'italic', lineHeight: 1.15 }}>
          de la Signification
        </div>
        <div style={{ width: '60px', height: '2px', background: '#8b7355', margin: '30px 0' }}></div>
        <div style={{ fontSize: '22px', color: '#5a4a3a', textAlign: 'center', maxWidth: '800px', lineHeight: 1.6 }}>
          Dualisme de la signification · Tripartition des structures signifiantes · Irréductibilité de la signification à la matière
        </div>
        <div style={{ marginTop: '36px', fontSize: '15px', color: '#8b7355', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          Avatar philosophique interactif
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
