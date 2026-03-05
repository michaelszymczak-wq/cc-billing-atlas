import * as path from 'path';
import * as os from 'os';

export const CONFIG_PATH = process.env.CONFIG_PATH
  || path.join(os.homedir(), '.innovint-billing-config.json');
