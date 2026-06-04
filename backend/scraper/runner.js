const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const cheerio = require('cheerio');

// Command line usage: node runner.js <extension_file_path> <method> <params_json_or_base64>
const extensionPath = process.argv[2];
const method = process.argv[3];
const paramsRaw = process.argv[4] || '';

let paramsJson = '{}';
if (paramsRaw) {
    if (paramsRaw.startsWith('{') || paramsRaw.startsWith('[')) {
        paramsJson = paramsRaw;
    } else {
        try {
            paramsJson = Buffer.from(paramsRaw, 'base64').toString('utf8');
        } catch (e) {
            paramsJson = paramsRaw;
        }
    }
}

if (!extensionPath || !method) {
    console.error(JSON.stringify({ error: "Missing required arguments: <extension_path> <method>" }));
    process.exit(1);
}

try {
    const fullPath = path.resolve(extensionPath);
    if (!fs.existsSync(fullPath)) {
        console.error(JSON.stringify({ error: `Extension file not found at: ${fullPath}` }));
        process.exit(1);
    }

    const code = fs.readFileSync(fullPath, 'utf8');
    const params = JSON.parse(paramsJson);

    const moduleObj = { exports: {} };

    // Context / Sandbox for VM execution
    const sandbox = {
        console: {
            log: (...args) => {}, // Suppress console logs to keep stdout clean for JSON data
            error: (...args) => console.error('[Sandbox Error]', ...args),
            warn: (...args) => console.warn('[Sandbox Warning]', ...args)
        },
        axios: axios,
        cheerio: cheerio,
        module: moduleObj,
        exports: moduleObj.exports,
        require: (name) => {
            if (name === 'axios') return axios;
            if (name === 'cheerio') return cheerio;
            throw new Error(`Module '${name}' is not allowed in this extension sandbox`);
        }
    };

    // Run code in isolated context
    const context = vm.createContext(sandbox);
    vm.runInContext(code, context, { filename: extensionPath });

    // Extract the extension object
    let extension = sandbox.module.exports;
    if (!extension || Object.keys(extension).length === 0) {
        extension = sandbox.exports;
    }

    if (method === 'getMetadata') {
        console.log(JSON.stringify({ name: extension.name || 'Unknown', version: extension.version || '1.0.0' }));
        process.exit(0);
    }

    if (!extension || typeof extension[method] !== 'function') {
        console.error(JSON.stringify({ error: `Method '${method}' is not implemented in extension '${extensionPath}'` }));
        process.exit(1);
    }

    // Call method and print response to stdout as JSON
    extension[method](params)
        .then(result => {
            console.log(JSON.stringify(result));
            process.exit(0);
        })
        .catch(err => {
            console.error(JSON.stringify({ error: err.message, stack: err.stack }));
            process.exit(1);
        });

} catch (err) {
    console.error(JSON.stringify({ error: err.message, stack: err.stack }));
    process.exit(1);
}
