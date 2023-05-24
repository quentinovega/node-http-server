const http = require('http');
const url = require('url')
const fs = require('fs')

const port = process.env.PORT || 3000;
const env = process.env.ENV || 'dev';

const databasePath = "./database.json"

const fsReadFileSyncToArray = (filePath) => {
  return JSON.parse(fs.readFileSync(filePath));
}

const uuidv4 = () => {
  var d = new Date().getTime();//Timestamp
  var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now() * 1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16;//random number between 0 and 16
    if (d > 0) {//Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {//Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}


const transformers = {
  'external': ({id, nom, prenom, pays}) => ({id, nom, prenom, pays}),
  'internal': ({id, nom, prenom, pays, email}) => ({id, nom, prenom, pays, email}),
  'none': ({id, nom, prenom, pays}) => ({id, nom, prenom, pays}),
};

const healthHandler = (_, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.write(JSON.stringify({ health: 'ok' }));
  response.end();
};

const userHandler = (request, response, param) => {
  const data = fsReadFileSyncToArray(databasePath)
  const method = request.method

  const caller = request.headers['X-Caller-Key'] || request.headers['x-caller-key'] || 'none';
  const transformer = transformers[caller]

  const users = data.map(transformer).splice(0, env === 'prod' ? data.length : 10)


  switch (method) {
    case 'GET':
      if (param) {
        const user = users.find(u => u.id === param)

        if (user) {
          response.writeHead(200, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify(user));
          response.end();
        } else {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ "error": "user not found" }));
          response.end();
        }
      } else {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify(users));
        response.end();
      }
      break;
    case 'POST':
      let body = [];
      request.on('data', (chunk) => {
        body.push(chunk);
      }).on('end', () => {
        body = Buffer.concat(body).toString();


        const user = JSON.parse(body)

        if (!user.prenom || !user.nom || !user.pays || !user.email) {
          response.writeHead(422, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ "error": "wrong user format" }));
          response.end();
        } else {

          const uuid = uuidv4()


          response.writeHead(201, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ ...user, id: uuid }));
          response.end();
        }

      });

      break;
    case 'PUT':
      let putBody = [];
      request.on('data', (chunk) => {
        putBody.push(chunk);
      }).on('end', () => {
        putBody = Buffer.concat(putBody).toString();

        const user = JSON.parse(putBody)

        if (!param) {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ "error": "user not found" }));
          response.end();
        } else if (!user.prenom || !user.nom || !user.pays || !user.email || !user.id) {
          response.writeHead(422, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ "error": "wrong user format" }));
          response.end();
        } else {
          response.writeHead(202, { 'Content-Type': 'application/json' });
          response.write(JSON.stringify({ ...user }));
          response.end();
        }

      });
      break;
    case 'DELETE':
      const deletedUser = users.find(u => u.id === param)
      if (deletedUser) {
        response.writeHead(202, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify(JSON.stringify(deletedUser)));
        response.end();
      } else {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.write(JSON.stringify({ "error": "user not found" }));
        response.end();
      }
      break;
    default:
      response.writeHead(500, { 'Content-Type': 'application/json' });
      response.write(JSON.stringify({ "oops": "something's wrong" }));
      response.end();
      break;
  }
}

const routes = {
  'health': healthHandler,
  'users': userHandler
}

const server = http.createServer((request, response) => {
  const parts = url.parse(request.url);
  const [basePath, param] = parts.pathname.split('/').filter(x => !!x)
  const route = routes[basePath];

  if (route) {
    route(request, response, param);
  } else {
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.write(JSON.stringify({ error: 'Not Found' }));
    response.end();
  }
});
server.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err)
  }
  console.log(`API ${env} is listening on ${port}`)
});