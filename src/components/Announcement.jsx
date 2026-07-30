// Full-screen banner shown to every player when a special code broadcasts a message.
export default function Announcement({ announce }) {
  if (!announce) return null;
  return (
    <div className="announcement-overlay">
      <div className="announcement-card">
        <div className="announcement-card__emoji">{announce.emoji}</div>
        <div className="announcement-card__text">{announce.text}</div>
      </div>
    </div>
  );
}
