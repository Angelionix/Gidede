#!/usr/bin/env bash
# === Утилита версионирования Gidede ===
# Использование:
#   ./scripts/version.sh              — показать текущую версию
#   ./scripts/version.sh patch        — увеличить patch-версию (Z)
#   ./scripts/version.sh minor        — увеличить minor-версию (Y)
#   ./scripts/version.sh major        — увеличить major-версию (X)
#   ./scripts/version.sh set X.Y.Z    — установить конкретную версию

set -euo pipefail

VERSION_FILE="$(dirname "$0")/../VERSION"
CHANGELOG_FILE="$(dirname "$0")/../CHANGELOG.md"

current_version() {
    cat "$VERSION_FILE" | tr -d '[:space:]'
}

bump_version() {
    local part="$1"
    local current
    current=$(current_version)

    IFS='.' read -r x y z <<< "$current"

    case "$part" in
        major)
            x=$((x + 1))
            y=0
            z=0
            ;;
        minor)
            y=$((y + 1))
            z=0
            ;;
        patch)
            z=$((z + 1))
            ;;
        *)
            echo "Неизвестная часть версии: $part (используйте major/minor/patch)"
            exit 1
            ;;
    esac

    echo "${x}.${y}.${z}" > "$VERSION_FILE"
    echo "${x}.${y}.${z}"
}

set_version() {
    local new_version="$1"
    # Валидация формата X.Y.Z
    if ! echo "$new_version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
        echo "Ошибка: версия должна быть в формате X.Y.Z (например, 0.2.0)"
        exit 1
    fi
    echo "$new_version" > "$VERSION_FILE"
    echo "$new_version"
}

# Обновление версии в package.json
update_package_json() {
    local new_ver="$1"
    local pkg_file="$(dirname "$0")/../package.json"
    if command -v sed &>/dev/null; then
        sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"${new_ver}\"/" "$pkg_file"
    fi
}

# Обновление версии в pyproject.toml
update_pyproject_toml() {
    local new_ver="$1"
    local pyproject_file="$(dirname "$0")/../mini-services/api-service/pyproject.toml"
    if [ -f "$pyproject_file" ]; then
        sed -i "s/^version = \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/version = \"${new_ver}\"/" "$pyproject_file"
    fi
}

# Обновление версии в mini-services package.json
update_api_package_json() {
    local new_ver="$1"
    local pkg_file="$(dirname "$0")/../mini-services/api-service/package.json"
    if [ -f "$pkg_file" ]; then
        sed -i "s/\"version\": \"[0-9]\+\.[0-9]\+\.[0-9]\+\"/\"version\": \"${new_ver}\"/" "$pkg_file"
    fi
}

case "${1:-show}" in
    show)
        echo "Gidede v.$(current_version)"
        ;;
    patch|minor|major)
        old_ver=$(current_version)
        new_ver=$(bump_version "$1")
        update_package_json "$new_ver"
        update_pyproject_toml "$new_ver"
        update_api_package_json "$new_ver"
        echo "Версия обновлена: v.${old_ver} → v.${new_ver}"
        echo "Не забудьте обновить CHANGELOG.md!"
        ;;
    set)
        if [ -z "${2:-}" ]; then
            echo "Использование: ./scripts/version.sh set X.Y.Z"
            exit 1
        fi
        old_ver=$(current_version)
        new_ver=$(set_version "$2")
        update_package_json "$new_ver"
        update_pyproject_toml "$new_ver"
        update_api_package_json "$new_ver"
        echo "Версия установлена: v.${old_ver} → v.${new_ver}"
        ;;
    *)
        echo "Использование: $0 [show|patch|minor|major|set X.Y.Z]"
        exit 1
        ;;
esac
