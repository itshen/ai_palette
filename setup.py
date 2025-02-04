from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="ai-palette",
    version="0.1.1",
    author="Eason Tsui",
    author_email="easontsui@gmail.com",
    description="一个统一的AI聊天接口，支持多个AI提供商",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/easontsui/ai_palette",
    packages=find_packages(),
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
    ],
    python_requires=">=3.7",
    install_requires=[
        "requests>=2.25.0",
        "aiohttp>=3.8.0",
        "python-dotenv>=0.19.0",
        "loguru>=0.5.0",
    ],
) 