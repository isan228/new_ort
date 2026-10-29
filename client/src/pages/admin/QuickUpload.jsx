import { useLang } from '../../context/LangContext';
import { TxtUploadButtons } from './adminUi';
import { CompareTxtButton } from './AdminCompare';

// "Upload TXT" right in a topic row: picks the preview that fits the section's format.
// format: standard | geometry | compare; anything else (reading, group) has no quick upload.
export default function QuickUpload({ testId, format, onDone }) {
  const { t } = useLang();
  const label = t('admin.quickUpload');
  if (format === 'compare') return <CompareTxtButton testId={testId} label={label} onDone={onDone} />;
  if (format === 'standard' || format === 'geometry') {
    return <TxtUploadButtons testId={testId} requireImage={format === 'geometry'} label={label} onDone={onDone} />;
  }
  return null;
}
