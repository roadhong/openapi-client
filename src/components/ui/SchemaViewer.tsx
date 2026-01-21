import type { ReactNode } from 'react';

type SchemaViewerProps = {
  schema: Record<string, unknown> | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const getSchemaType = (schema: Record<string, unknown> | null | undefined): string => {
  if (!schema) {
    return 'unknown';
  }
  const type = schema.type;
  if (typeof type === 'string') {
    if (type === 'array' && schema.items && isRecord(schema.items)) {
      return `array<${getSchemaType(schema.items)}>`;
    }
    return type;
  }
  if (Array.isArray(schema.enum)) {
    return 'enum';
  }
  if (isRecord(schema.properties)) {
    return 'object';
  }
  return 'object';
};

const SchemaViewer = ({ schema }: SchemaViewerProps) => {
  if (!schema) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-300">
        Schema is not found.
      </p>
    );
  }

  const buildSchemaOptions = (schemaValue: Record<string, unknown>): string[] => {
    const options: string[] = [];

    if (schemaValue?.format) {
      options.push(`format=${schemaValue.format}`);
    }
    if (schemaValue?.nullable) {
      options.push('nullable');
    }
    if (Array.isArray(schemaValue?.enum) && schemaValue.enum.length > 0) {
      options.push(`enum=${schemaValue.enum.map(String).join(', ')}`);
    }
    if (schemaValue?.minimum !== undefined) {
      options.push(`min=${schemaValue.minimum}`);
    }
    if (schemaValue?.maximum !== undefined) {
      options.push(`max=${schemaValue.maximum}`);
    }
    if (schemaValue?.exclusiveMinimum !== undefined) {
      options.push(`exclusiveMin=${schemaValue.exclusiveMinimum}`);
    }
    if (schemaValue?.exclusiveMaximum !== undefined) {
      options.push(`exclusiveMax=${schemaValue.exclusiveMaximum}`);
    }
    if (schemaValue?.multipleOf !== undefined) {
      options.push(`multipleOf=${schemaValue.multipleOf}`);
    }
    if (schemaValue?.minLength !== undefined) {
      options.push(`minLength=${schemaValue.minLength}`);
    }
    if (schemaValue?.maxLength !== undefined) {
      options.push(`maxLength=${schemaValue.maxLength}`);
    }
    if (schemaValue?.pattern) {
      options.push(`pattern=${schemaValue.pattern}`);
    }
    if (schemaValue?.minItems !== undefined) {
      options.push(`minItems=${schemaValue.minItems}`);
    }
    if (schemaValue?.maxItems !== undefined) {
      options.push(`maxItems=${schemaValue.maxItems}`);
    }
    if (schemaValue?.uniqueItems) {
      options.push('uniqueItems');
    }
    if (schemaValue?.minProperties !== undefined) {
      options.push(`minProperties=${schemaValue.minProperties}`);
    }
    if (schemaValue?.maxProperties !== undefined) {
      options.push(`maxProperties=${schemaValue.maxProperties}`);
    }
    if (schemaValue?.readOnly) {
      options.push('readOnly');
    }
    if (schemaValue?.writeOnly) {
      options.push('writeOnly');
    }
    if (schemaValue?.deprecated) {
      options.push('deprecated');
    }
    if (schemaValue?.example !== undefined) {
      options.push(`example=${String(schemaValue.example)}`);
    }
    if (
      Array.isArray(schemaValue?.examples) &&
      schemaValue.examples.length > 0
    ) {
      options.push(`examples=${schemaValue.examples.map(String).join(', ')}`);
    }
    const xml = schemaValue?.xml;
    if (isRecord(xml)) {
      if (typeof xml.name === 'string') {
        options.push(`xmlName=${xml.name}`);
      }
      if (typeof xml.namespace === 'string') {
        options.push(`xmlNs=${xml.namespace}`);
      }
      if (xml.wrapped) {
        options.push('xmlWrapped');
      }
    }

    return options;
  };

  const renderFields = (currentSchema: Record<string, unknown>, level: number = 0): ReactNode[] => {
    const required = Array.isArray(currentSchema?.required) ? currentSchema.required : [];
    const requiredSet = new Set<string>(required.filter((r): r is string => typeof r === 'string'));
    const properties = isRecord(currentSchema?.properties) ? currentSchema.properties : {};
    const hasArrayItems =
      currentSchema?.type === 'array' &&
      currentSchema?.items &&
      !Object.keys(properties).length;

    const effectiveEntries = hasArrayItems && isRecord(currentSchema.items)
      ? [['items', currentSchema.items] as [string, Record<string, unknown>]]
      : Object.entries(properties).map(([k, v]) => [k, isRecord(v) ? v : {}] as [string, Record<string, unknown>]);

    const baseFields = effectiveEntries.map(([name, value], index) => {
      const schemaValue = isRecord(value) ? value : {};
      const type = getSchemaType(schemaValue);
      const description =
        (typeof schemaValue?.description === 'string' ? schemaValue.description : '') ||
        (hasArrayItems && typeof currentSchema?.description === 'string' ? currentSchema.description : '');
      const defaultValue =
        schemaValue?.default !== undefined ? String(schemaValue.default) : '';
      const options = buildSchemaOptions(schemaValue);
      const hasChildren = Boolean(
        schemaValue?.properties || schemaValue?.items || schemaValue?.anyOf
      );

      const isLastItem = index === effectiveEntries.length - 1;
      const showDivider = !(level > 0 && isLastItem);

      return (
        <div
          key={`${level}-${name}`}
          className={`py-2 ${showDivider ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
        >
          <div
            className="grid gap-3 text-sm"
            style={{
              gridTemplateColumns:
                'minmax(120px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(150px, 2fr) minmax(150px, 2fr)',
            }}
          >
            <div
              style={{ paddingLeft: level * 12 }}
              className="flex items-center gap-1 min-w-0 font-medium text-slate-700 dark:text-slate-200 break-words"
            >
              <span className="truncate" title={name}>
                {name}
              </span>
              {requiredSet.has(name) && (
                <span className="text-rose-500 dark:text-rose-400 flex-shrink-0">
                  *
                </span>
              )}
            </div>
            <div className="text-slate-600 dark:text-slate-300 min-w-0 break-words">
              {type}
            </div>
            <div className="text-slate-600 dark:text-slate-300 min-w-0 break-words">
              {defaultValue || '-'}
            </div>
            <div className="text-slate-500 dark:text-slate-300 min-w-0 break-words">
              {description || '-'}
            </div>
            <div className="text-slate-500 dark:text-slate-300 min-w-0 break-words">
              {options.length > 0 ? (
                <div className="space-y-0.5">
                  {options.map((option) => (
                    <div key={option} className="break-words">
                      {option}
                    </div>
                  ))}
                </div>
              ) : (
                '-'
              )}
            </div>
          </div>
          {/* Display nested schemas with indentation */}
          {hasChildren && (
            <div className="mt-2">
              {Array.isArray(schemaValue?.anyOf) && schemaValue.anyOf.length === 1 && isRecord(schemaValue.anyOf[0])
                ? // Render schema directly when anyOf has only one item
                  renderFields(schemaValue.anyOf[0], level + 1)
                : renderFields(schemaValue, level + 1)}
            </div>
          )}
        </div>
      );
    });

    const optionSections: ReactNode[] = [];

    // Show as option sections only when anyOf has 2 or more items
    if (Array.isArray(currentSchema?.anyOf) && currentSchema.anyOf.length > 1) {
      currentSchema.anyOf.forEach((option, index) => {
        if (!isRecord(option)) return;
        optionSections.push(
          <div
            key={`${level}-anyOf-${index}`}
            className="border-b border-slate-100 dark:border-slate-700 py-2"
          >
            <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-300">
              anyOf {index + 1}
            </p>
            <div className="mt-2">{renderFields(option, level + 1)}</div>
          </div>
        );
      });
    }

    if (optionSections.length === 0) {
      return baseFields;
    }

    return [
      ...(baseFields.length > 0
        ? [
            <div
              key={`${level}-base`}
              className="border-b border-slate-100 dark:border-slate-700 py-2"
            >
              <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-300">
                base
              </p>
              <div className="mt-2">{baseFields}</div>
            </div>,
          ]
        : []),
      ...optionSections,
    ];
  };

  // Render schema directly when anyOf has only one item
  if (Array.isArray(schema?.anyOf) && schema.anyOf.length === 1 && isRecord(schema.anyOf[0])) {
    const mergedSchema = {
      ...schema,
      ...schema.anyOf[0],
      // Remove anyOf and keep remaining properties
      anyOf: undefined,
    };
    delete mergedSchema.anyOf;
    return <SchemaViewer schema={mergedSchema} />;
  }

  if (Array.isArray(schema?.oneOf) && schema.oneOf.length > 0) {
    const baseSchema = { ...schema };
    delete baseSchema.oneOf;
    const hasBaseFields =
      isRecord(baseSchema?.properties) && Object.keys(baseSchema.properties).length > 0;
    const schemas = [
      ...(hasBaseFields ? [baseSchema] : []),
      ...schema.oneOf.filter(isRecord),
    ];
    return (
      <div className="space-y-3">
        {schemas.map((item, index) => (
          <SchemaViewer key={`schema-${index}`} schema={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
      <div
        className="grid gap-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
        style={{
          gridTemplateColumns:
            'minmax(120px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(150px, 2fr) minmax(150px, 2fr)',
        }}
      >
        <div>Field</div>
        <div>Type</div>
        <div>Default</div>
        <div>Description</div>
        <div>Options</div>
      </div>
      <div className="px-3 py-1 text-sm">{renderFields(schema)}</div>
      {(!isRecord(schema?.properties) || Object.keys(schema.properties).length === 0) &&
        !(schema?.type === 'array' && schema?.items) &&
        !(Array.isArray(schema?.anyOf) && schema.anyOf.length > 0) &&
        !(Array.isArray(schema?.oneOf) && schema.oneOf.length > 0) && (
          <div className="px-3 py-3 text-sm text-slate-500 dark:text-slate-300">
            No nested fields.
          </div>
        )}
    </div>
  );
};

export default SchemaViewer;
