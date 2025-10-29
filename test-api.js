const http = require('http');

function testAPI(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`${path} - Status: ${res.statusCode}`);
          console.log(`${path} - Data:`, JSON.stringify(jsonData, null, 2));
          resolve(jsonData);
        } catch (error) {
          console.log(`${path} - Raw response:`, data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`${path} - Error:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function testAPIs() {
  try {
    console.log('Testing /api/questions...');
    await testAPI('/api/questions');
    
    console.log('\nTesting /api/categories...');
    await testAPI('/api/categories');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAPIs();
