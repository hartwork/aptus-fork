# setup.py
import distutils
from distutils.core import setup, Extension

try:
    import numpy
except:
    raise Exception("Need numpy, from http://numpy.scipy.org/")

version = "1.0"

setup(
    name = "Aptus",
    description = "Fast Mandelbrot calculation",
    version = version,
    
    packages = [
        'aptus'
        ],
    
    ext_modules = [
        Extension(
            "aptus_engine",
            sources=["ext/engine.c"],
            include_dirs=[numpy.get_include()],
            #extra_compile_args=['-O3', '-ffast-math'],
            ),
        ],
    
    scripts = [
        'scripts/aptusmain.py',
        ],    
    )
