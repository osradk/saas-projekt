#!/bin/bash

# Find PID for proces på port 5001
PID=$(lsof -t -i:5001)

# Hvis der er en proces, dræb den
if [ ! -z "$PID" ]; then
  echo "Dræber proces på port 5001 (PID: $PID)"
  kill -9 $PID
else
  echo "Ingen proces kører på port 5001"
fi

# Start serveren igen
echo "Starter server..."
npm run dev 