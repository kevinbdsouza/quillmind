# QuillMind

QuillMind is an AI‑powered writing assistant built with **Electron** and **React**. The project also includes a small Node.js API in the `backend` folder.

## Features

- Electron desktop shell
- React front end powered by Vite
- Express backend with JWT authentication

## Getting Started

### Frontend

```bash
# install dependencies
npm install

# run the Vite dev server
npm run dev

# launch the Electron app (after building or during development)
npm start
```

### Backend

```bash
cd backend
npm install

# start the API server
npm start
# or run with nodemon
npm run dev
```

The backend expects a PostgreSQL database and reads connection details from environment variables (see `backend/dbConfig.js`).

## License

This project is licensed under the MIT License.
