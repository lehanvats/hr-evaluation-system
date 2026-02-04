"""
MCQ Blueprint
Handles MCQ question submission and retrieval
"""

from flask import Blueprint

MCQ = Blueprint('mcq', __name__)

from . import route
