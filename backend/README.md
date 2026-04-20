# Backend API

Node.js + Express + MongoDB Atlas backend for Smart Time Manager.

## Environment Variables

Create .env file:

PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string_here

## Install and Run

npm install
npm run dev

## Endpoints

Base: /api

1) POST /tasks
Request body:
{
  "title": "Study OS chapter",
  "time": "20:00"
}

2) GET /tasks
Returns all tasks sorted by latest first.
