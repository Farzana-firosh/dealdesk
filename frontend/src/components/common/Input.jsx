import { useId, useState } from 'react';
import Field from './Field';
import Icon from './Icon';

/** Text input with optional label, leading icon and password visibility toggle. */
export default function Input({ label, hint, error, icon, type = 'text', aside, ...props }) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} aside={aside}>
      <div className={`control${error ? ' has-error' : ''}`}>
        {icon && <Icon name={icon} size={16} />}
        <input id={id} type={isPassword && reveal ? 'text' : type} {...props} />
        {isPassword && (
          <button type="button" className="adornment" onClick={() => setReveal((v) => !v)} aria-label="Toggle password visibility">
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
    </Field>
  );
}
