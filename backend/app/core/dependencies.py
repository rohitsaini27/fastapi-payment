from fastapi import Request


def get_database(request: Request):
    return request.app.database


def get_mongodb_client(request: Request):
    return request.app.mongodb_client
