import Icon from './Icon';

const cx = (...c) => c.filter(Boolean).join(' ');

/** variant: default | primary | success | danger | ghost · size: sm | md | lg */
export default function Button({ variant = 'default', size = 'md', icon, iconRight, block, loading, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cx('btn', variant !== 'default' && `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', !children && 'icon-btn', className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {loading ? 'Please wait…' : children}
      {iconRight && <Icon name={iconRight} size={17} />}
    </button>
  );
}
