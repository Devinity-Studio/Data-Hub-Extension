import { createJiti } from 'jiti';
import { resolve } from 'pathe';
import { createServer } from 'wxt';
import reactModule from '@wxt-dev/module-react';

const jiti = createJiti(resolve(process.cwd(), 'wxt.config.ts'), {
  interopDefault: true,
  moduleCache: false,
});

const configModule = await jiti.import(resolve(process.cwd(), 'wxt.config.ts'));
console.log('configModule keys:', Object.keys(configModule ?? {}));
console.log('configModule.default:', typeof configModule.default);
console.log('configModule.default.modules:', configModule.default?.modules);
console.log('configModule.default.manifest:', configModule.default?.manifest);
console.log('reactModule:', typeof reactModule, Object.keys(reactModule ?? {}));
console.log('reactModule.default:', typeof reactModule.default, reactModule.default);

try {
  const server = await createServer({ root: process.cwd(), config: { ...configModule.default, modules: [reactModule.default] } });
  console.log('server created:', typeof server);
} catch (e) {
  console.error('server error', e.message);
}

console.log('done');
