from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="ai-palette",
    version="0.1.7",
    author="Eason Tsui",
    author_email="easontsui@gmail.com",
    description="一个统一的AI聊天接口，支持多个AI提供商",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/itshen/ai_palette",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        'ai_palette': [
            'templates/*.html',
            'static/*',
            'static/**/*'
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
    ],
    python_requires=">=3.7",
    install_requires=[
        "requests>=2.31.0",
        "aiohttp>=3.9.1",
        "python-dotenv>=1.0.0",
        "loguru>=0.7.2",
        "flask>=3.0.0",
        "typing-extensions>=4.9.0",
    ],
    extras_require={
        'test': [
            'pytest>=7.4.3',
        ],
    },
    entry_points={
        'console_scripts': [
            'ai-palette-server=ai_palette.app:run_server',
        ],
    },
) 