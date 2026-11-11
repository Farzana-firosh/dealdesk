import { useId } from 'react';
import Field from './Field';

export default function TextArea({ label, hint, error, rows = 3, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className={`control${error ? ' has-error' : ''}`}>
        <textarea id={id} rows={rows} {...props} />
      </div>
    </Field>
  );
}
