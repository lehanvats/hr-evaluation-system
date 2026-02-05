from flask import Blueprint

CodeExecution = Blueprint('CodeExecution', __name__, url_prefix='/api/code')

from . import route
