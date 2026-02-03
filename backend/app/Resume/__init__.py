"""
Resume Blueprint
Handles resume upload and management operations
"""

from flask import Blueprint

Resume = Blueprint('resume', __name__)

from . import route
