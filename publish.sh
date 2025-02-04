#!/bin/bash

# 设置严格模式
set -e

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 打印带颜色的信息
info() {
    echo -e "${GREEN}[INFO] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# 检查 Python 版本
check_python() {
    info "检查 Python 版本..."
    if ! command -v python3.11 &> /dev/null; then
        error "需要 Python 3.11"
        exit 1
    fi
}

# 检查并安装依赖
check_dependencies() {
    info "检查并安装依赖..."
    python3.11 -m pip install --upgrade pip
    python3.11 -m pip install --upgrade build
    python3.11 -m pip install --upgrade twine
}

# 清理旧的构建文件
clean_old_builds() {
    info "清理旧的构建文件..."
    rm -rf build/ dist/ *.egg-info/
}

# 从 setup.py 获取当前版本
get_current_version() {
    echo $(grep "version=\".*\"" setup.py | cut -d'"' -f2)
}

# 更新版本号
update_version() {
    local current_version=$(get_current_version)
    info "当前版本: $current_version"
    
    # 提示输入新版本号
    read -p "请输入新版本号 (直接回车使用当前版本): " new_version
    
    if [ -z "$new_version" ]; then
        new_version=$current_version
        info "使用当前版本: $new_version"
    else
        info "更新版本到: $new_version"
        
        # 更新 setup.py 中的版本号
        sed -i '' "s/version=\".*\"/version=\"$new_version\"/" setup.py
        
        # 更新 pyproject.toml 中的版本号
        sed -i '' "s/version = \".*\"/version = \"$new_version\"/" pyproject.toml
    fi
}

# 构建包
build_package() {
    info "构建包..."
    python3.11 -m build
}

# 上传到 PyPI
upload_to_pypi() {
    info "上传到 PyPI..."
    python3.11 -m twine upload dist/*
}

# 主函数
main() {
    info "开始发布流程..."
    
    # 执行发布流程
    check_python
    check_dependencies
    clean_old_builds
    update_version
    build_package
    upload_to_pypi
    
    info "发布完成！"
    
    # 显示安装命令
    version=$(get_current_version)
    echo ""
    echo "安装命令："
    echo "pip install ai-palette==$version"
}

# 执行主函数
main 