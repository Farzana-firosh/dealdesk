import { useId } from 'react';
import Field from './Field';
import Icon from './Icon';

/** options: [{ value, label }] */
export default function Select({ label, hint, error, options = [], placeholder, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className={`control${error ? ' has-error' : ''}`}>
        <select id={id} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Icon name="caret" size={16} className="select-caret" />
      </div>
    </Field>
  );
}
