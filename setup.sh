mkdir -p data
mkdir -p data/paho/raw
mkdir -p data/paho/iso
mkdir -p data/paho/epi

check_file() {
  local dir="$1"
  if [ -d "$dir" ]; then
      echo "yay: $dir found"
  else
      echo "Missing required $dir"
  fi
}
check_file './data/paho/iso'
check_file './data/paho/raw'
check_file './data/paho/epi'
