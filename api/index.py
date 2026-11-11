import sys
import os

# supaya Python bisa nemu app.py di folder root
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app import app