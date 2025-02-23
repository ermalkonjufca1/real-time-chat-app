# REAL-TIME CHAT APPLICATION

This real-time chat app, built with Node.js, Socket.io, and Redis, lets users enter a username, join unique chat rooms, and exchange messages instantly. It persists messages (showing the last 10 on join) and offers optional features like typing indicators, private messaging, and Docker support.

## Prerequisites

*   [Docker](https://docs.docker.com/get-docker/)
*   [Docker Compose](https://docs.docker.com/compose/install/)

## Running with Docker Compose

1.  **Clone the Repository**
    
    ```
    git clone https://github.com/ermalkonjufca1/real-time-chat-app.git
    cd real-time-chat-app
    ```
    
2.  **Configure Environment Variables**
    
    Navigate to the `server` folder and copy the .env.example file and rename it to .env.
    Edit `.env` if needed.
    
3.  **Build and Run Containers**
    
    In the project root, run:
    
    ```
    docker-compose up --build
    ```
    
    This command builds the server container and starts both the server and Redis containers.
    
4.  **Access the Application**
    
    ```
    http://localhost:3000
    ```
    
5.  **Stop the Application**
    
    Press `Ctrl+C` in your terminal, then run:
    
    ```
    docker-compose down
    ```
    

## Running Locally Without Docker

1.  **Install Dependencies**
    
    ```
    cd server
    npm install
    ```
    
2.  **Ensure Redis is Running**
    
    Make sure a Redis server is running locally, update your environment variables as needed.
    
3.  **Run the Server**
    
    ```
    node server.js
    ```
    
4.  **Access the Application**
    
    Visit [http://localhost:3000](http://localhost:3000) in your browser.