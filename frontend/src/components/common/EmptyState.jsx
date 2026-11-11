import Icon from './Icon';

export default function EmptyState({ icon = 'inbox', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <div className="empty-title">{title}</div>
      {children && <div>{children}</div>}
    </div>
  );
}
