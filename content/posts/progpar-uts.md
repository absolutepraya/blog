---
title: "ProgPar UTS - Study Guide"
date: 2026-04-05
description: "Rangkuman materi Pemrograman Paralel (ProgPar) untuk persiapan UTS pilihan ganda. Mencakup HPC, Cluster Computing, MPI, OpenMP, dan GPU/CUDA."
tags: ["progpar", "study-guide"]
toc: true
_build:
  list: never
  publishResources: true
  render: always
---

Rangkuman materi ProgPar untuk UTS pilihan ganda. Disusun berdasarkan slide kuliah - fokus ke konsep yang sering muncul di soal pilihan ganda dan jebakan umum.

---

## Topik 1: Pengantar HPC (Kenapa HPC Perlu)

Sebelum masuk ke teknis, kita perlu paham dulu kenapa High Performance Computing itu penting dan di mana dia dipakai.

- **Computational model** = model matematika yang digunakan untuk mempelajari sistem kompleks secara numerik lewat simulasi. Ini fondasi dari semua HPC.
- HPC dibutuhkan karena simulasi yang realistis butuh komputasi yang sangat besar - makin panjang simulasinya, makin besar kebutuhannya

> **HPC (High Performance Computing)** = penggunaan superkomputer dan teknik komputasi paralel untuk menyelesaikan masalah yang terlalu besar/kompleks untuk komputer biasa.

### Contoh Aplikasi HPC

Kenapa HPC diperlukan? Karena banyak masalah dunia nyata yang tidak bisa diselesaikan dengan komputer biasa:

- **Molecular dynamics** - simulasi pergerakan atom/molekul
- **Drug design (in silico)** - desain obat secara virtual, tanpa harus eksperimen lab dulu
- **Oil & gas discovery** - eksplorasi minyak dan gas bumi
- **COVID-19 research** - riset pandemi yang butuh simulasi cepat
- **Hyperthermia simulation** - simulasi terapi kanker menggunakan panas

> **In silico** = eksperimen yang dilakukan di komputer (simulasi), bukan di lab (in vitro) atau di makhluk hidup (in vivo). Sering muncul di konteks drug design.

### GPU vs Cluster

- GPU (contoh: GTX 470) bisa memberikan speedup **11-12x** dibanding cluster 16-core, dengan biaya hanya **25%** dari cluster
- Ini menunjukkan bahwa GPU sangat cost-effective untuk masalah tertentu

### TOP500 dan Indonesia

- **TOP500.org** = situs yang meranking superkomputer dunia
- Ada korelasi antara **kematangan suatu negara** dengan **kapabilitas HPC-nya** - *ini poin yang sering ditanyakan*
- Tantangan Indonesia: big data, biodiversitas besar (30.000+ spesies tanaman, 9.600+ tanaman obat), tapi HPC terbatas

### Solusi HPC

- **Cluster computing** - gabungkan banyak komputer jadi satu unit
- **GPU integration** - manfaatkan GPU untuk komputasi paralel
- **Cloud computing** - gunakan resource cloud on-demand
- **Resource sharing** - berbagi sumber daya antar institusi

### HPC + AI

- Machine learning untuk drug design (virtual screening)
- SGD (Stochastic Gradient Descent) bisa diparalelkan dengan **mini-batch parallelism**

---

## Topik 2: Cluster Computing

Setelah tahu kenapa HPC penting, sekarang kita bahas salah satu implementasinya: cluster computing.

- **Cluster** = beberapa komputer/server yang digabung jadi satu unit untuk performa komputasi yang lebih baik
- Kuncinya: banyak mesin biasa digabungkan, bukan satu mesin super mahal

### Komponen Cluster

Setiap cluster punya komponen-komponen ini - pahami fungsi masing-masing:

| Komponen | Fungsi |
|----------|--------|
| **Nodes** | Unit dasar, bisa fisik atau virtual, punya CPU/RAM/storage/OS |
| **Network** | Jaringan cepat dan reliable untuk komunikasi antar node |
| **Cluster Manager** | Software yang mengkoordinasi operasi dan resource (scheduling, monitoring, alokasi) |
| **Middleware** | Layer software antara OS dan aplikasi |
| **OS** | Sistem operasi di tiap node |
| **Storage** | Penyimpanan data |
| **Security** | Keamanan cluster |

> **Middleware** = software penghubung antara OS dan aplikasi. Dia yang bikin aplikasi gak perlu tahu detail hardware/OS di bawahnya. Contoh: MPI library itu termasuk middleware.

### Jenis-jenis Cluster

*Ini penting buat pilihan ganda - pahami perbedaan tiap jenis:*

| Jenis | Karakteristik |
|-------|---------------|
| **Distributed Computing** | Node tersebar secara geografis |
| **HPC Cluster** | High-performance, tightly coupled (node terhubung erat) |
| **Load Balancing** | Membagi beban kerja ke banyak server secara merata |
| **Cloud Cluster** | Virtual, resource on-demand |
| **GPU Cluster** | Menggunakan GPU untuk parallel processing |
| **Virtual Cluster** | Berjalan di atas virtual machines |

### Kelebihan dan Kekurangan Cluster

| Kelebihan | Kekurangan |
|-----------|------------|
| High performance | Konfigurasi kompleks |
| Scalability | Pengembangan aplikasi sulit |
| Efisiensi energi | Ketergantungan pada jaringan |
| Reliability | Biaya awal tinggi |
| Cost effective | Manajemen intensif |
| Flexibility | |

---

## Topik 3: Membangun Cluster

Sekarang kita masuk ke bagaimana cluster dibangun - mulai dari arsitektur sampai tools yang dipakai.

### Arsitektur Komputer Paralel yang Scalable

*Tabel ini sering muncul di soal pilihan ganda - perhatikan perbedaan memory model dan jumlah OS:*

| Arsitektur | Memory | Jumlah OS | Nodes | Interconnect |
|------------|--------|-----------|-------|-------------|
| **MPP** (Massively Parallel Processors) | Shared-nothing (terpisah) | Tiap node punya OS sendiri | Ratusan node | High-speed interconnect |
| **SMP** (Symmetric Multiprocessors) | Shared-everything (berbagi) | Satu copy OS | 2-64 prosesor | Internal bus |
| **Distributed Systems** | Terpisah | Tiap node punya OS sendiri | Bervariasi | Jaringan konvensional |
| **Clusters** | Terpisah per node | Single system image | 2+ workstation/PC | High-speed network |

> **Shared-nothing** = tiap node punya memori sendiri, tidak berbagi dengan node lain. Komunikasi lewat message passing.
>
> **Shared-everything** = semua prosesor mengakses memori yang sama. Komunikasi lewat shared variables.
>
> **Single system image** = meskipun terdiri dari banyak komputer, cluster terlihat seperti satu komputer dari sisi pengguna.

**Definisi cluster yang sering dikutip:**
"A cluster is a type of parallel or distributed processing system, which consists of a collection of interconnected stand-alone computers cooperatively working together as a single, integrated computing resource."

***Trap question:*** Soal mungkin mencampuradukkan MPP dan SMP. Ingat: **MPP = shared-nothing, banyak OS**. **SMP = shared-everything, satu OS**. Jangan kebalik!

### Karakteristik Cluster

- Satu node bisa single/multiprocessor system dengan memori, I/O, dan OS sendiri
- Umumnya 2+ komputer yang terhubung
- Bisa dalam satu cabinet atau terpisah secara fisik lewat LAN

### Langkah Membangun Cluster

Planning - Hardware selection - Network setup - OS installation - Middleware - Cluster manager install - Security config - Testing - Monitoring - Documentation - Maintenance

### SLURM (Cluster Manager)

SLURM adalah cluster manager yang paling umum digunakan. Pahami 3 fungsi utamanya:

> **SLURM** = Simple Linux Utility for Resource Management. Open source, fault-tolerant, highly scalable.

**Tiga fungsi utama SLURM:**

1. **Alokasi resource** - memberikan akses eksklusif/non-eksklusif ke compute nodes untuk durasi tertentu
2. **Framework job** - memulai, menjalankan, dan memonitor jobs (termasuk parallel jobs)
3. **Antrian job** - mengelola resource contention lewat pending job queues

### Arsitektur SLURM

| Komponen | Fungsi |
|----------|--------|
| **slurmctld** | Central manager daemon (otak SLURM) |
| **slurmd** | Daemon di setiap node (eksekutor) |
| **slurmdbd** | Database daemon (menyimpan data akuntansi) |
| **slurmrestd** | REST API daemon |

### Tools SLURM

| Tool | Fungsi | Tipe |
|------|--------|------|
| **srun** | Menjalankan job | User |
| **scancel** | Membatalkan job | User |
| **sinfo** | Info tentang nodes dan partitions | User |
| **squeue** | Info tentang job di antrian | User |
| **sacct** | Info akuntansi job | User |
| **scontrol** | Kontrol konfigurasi | Admin |
| **sacctmgr** | Manajemen akuntansi | Admin |

***Trap question:*** Soal bisa menanyakan mana yang user tool vs admin tool. **scontrol dan sacctmgr = admin. Sisanya = user.**

### Entitas dalam SLURM

- **Nodes** - komputer fisik/virtual
- **Partitions** - pengelompokan nodes (= job queues)
- **Jobs** - pekerjaan yang di-submit user
- **Job Steps** - langkah-langkah dalam satu job

---

## Topik 4: Pemrograman MPI

Ini topik paling berat dan paling banyak keluar di UTS. MPI adalah cara program berkomunikasi di sistem distributed memory.

> **MPI (Message Passing Interface)** = standar/spesifikasi untuk pemrograman paralel berbasis message passing. Bukan library spesifik, tapi standar yang diimplementasikan oleh berbagai library (OpenMPI, MPICH, dll).

### Konsep Dasar MPI

- **Process-centric model** - setiap proses punya memori sendiri, independen
- **Explicit message passing** - programmer harus secara eksplisit mengirim dan menerima pesan
- **Communicator** - mendefinisikan grup proses. `MPI_COMM_WORLD` = semua proses

### Struktur Program MPI

Setiap program MPI harus mengikuti pola ini:

```c
MPI_Init(&argc, &argv);          // Inisialisasi MPI
MPI_Comm_rank(MPI_COMM_WORLD, &rank);  // Dapat rank (ID proses)
MPI_Comm_size(MPI_COMM_WORLD, &size);  // Dapat jumlah proses

// ... komputasi dan komunikasi ...

MPI_Finalize();                  // Akhiri MPI
```

***Trap question:*** `MPI_Comm_rank` memberikan **rank** (ID unik proses, mulai dari 0). `MPI_Comm_size` memberikan **jumlah total proses**. Jangan tertukar!

### Jenis Komunikasi MPI

Ada dua kategori besar: point-to-point dan collective.

**Point-to-Point (antara 2 proses):**

| Fungsi | Arah | Penjelasan |
|--------|------|------------|
| `MPI_Send` | Pengirim ke penerima | Mengirim data ke proses tertentu |
| `MPI_Recv` | Penerima dari pengirim | Menerima data dari proses tertentu |

**Collective (melibatkan semua proses):**

| Fungsi | Pola | Penjelasan |
|--------|------|------------|
| `MPI_Bcast` | One-to-all | Broadcast data dari satu proses ke semua |
| `MPI_Scatter` | One-to-all (bagi rata) | Bagi data dari satu proses ke semua (setiap proses dapat bagian berbeda) |
| `MPI_Gather` | All-to-one | Kumpulkan data dari semua proses ke satu proses |
| `MPI_Reduce` | All-to-one (dengan operasi) | Gabungkan data dari semua proses dengan operasi (SUM, MAX, MIN, dll) |
| `MPI_Allreduce` | All-to-all (reduce + broadcast) | Reduce lalu hasilnya di-broadcast ke semua |
| `MPI_Allgather` | All-to-all (gather + broadcast) | Gather lalu hasilnya di-broadcast ke semua |
| `MPI_Barrier` | Synchronization | Semua proses menunggu sampai semua sampai di titik ini |

***Trap question - Bcast vs Scatter:*** Keduanya one-to-all, tapi **Bcast mengirim data yang SAMA ke semua proses**, sedangkan **Scatter membagi data menjadi bagian-bagian BERBEDA untuk tiap proses**. Ini sering dikacaukan di soal!

***Trap question - Reduce vs Allreduce:*** **Reduce** menyimpan hasil di SATU proses (root). **Allreduce** menyimpan hasil di SEMUA proses. Kalau soal tanya "semua proses mendapat hasil", jawabannya Allreduce.

### Operasi Reduce

`MPI_Reduce` mendukung operasi: `MPI_SUM`, `MPI_MAX`, `MPI_MIN`, `MPI_PROD`, dll.

### Timing

- `MPI_Wtime()` - mengukur wall clock time (waktu nyata yang berlalu)

### Kompilasi dan Eksekusi

```bash
mpicc program.c -o program          # Kompilasi
mpirun -np 4 ./program              # Jalankan dengan 4 proses
```

- `-np` menentukan jumlah proses. Kalau `-np 4`, maka rank = 0, 1, 2, 3

---

## Topik 5: Pemrograman OpenMP

Kalau MPI untuk distributed memory (antar node), OpenMP untuk shared memory (dalam satu node dengan banyak core).

> **OpenMP** = API untuk pemrograman paralel di shared memory system. Menggunakan compiler directives (pragma) untuk memparalelkan kode secara inkremental.

### Fork-Join Model

- Program dimulai dengan **satu master thread**
- Saat ketemu parallel region, master thread **fork** menjadi tim thread
- Setelah parallel region selesai, thread-thread **join** kembali ke master thread
- Ini terjadi berulang-ulang selama eksekusi program

> **Fork-join** = model eksekusi di mana satu thread (master) membuat banyak thread (fork) untuk kerja paralel, lalu menunggu semua selesai dan bergabung kembali (join).

### Directives OpenMP

Semua directive diawali `#pragma omp`:

| Directive | Fungsi |
|-----------|--------|
| `#pragma omp parallel` | Membuat parallel region (fork thread) |
| `#pragma omp for` | Memparalelkan for loop (bagi iterasi ke thread) |
| `#pragma omp parallel for` | Gabungan parallel + for (shortcut) |
| `#pragma omp sections` | Membagi kerja menjadi sections terpisah |
| `#pragma omp critical` | Mutual exclusion - hanya satu thread yang boleh masuk |
| `#pragma omp atomic` | Operasi atomik (lebih ringan dari critical) |
| `#pragma omp barrier` | Sinkronisasi - semua thread menunggu di titik ini |

***Trap question:*** **critical vs atomic** - keduanya untuk sinkronisasi, tapi **atomic** lebih ringan dan hanya untuk operasi sederhana (increment, assignment). **critical** lebih general tapi lebih berat (overhead lebih besar).

### Clauses OpenMP

Clauses ditambahkan setelah directive untuk mengontrol perilaku:

| Clause | Fungsi |
|--------|--------|
| `private(var)` | Setiap thread punya copy var sendiri (tidak di-share) |
| `shared(var)` | Semua thread mengakses var yang sama |
| `reduction(op:var)` | Tiap thread punya copy lokal, di akhir digabung dengan operasi op |
| `schedule(type, chunk)` | Cara membagi iterasi loop ke thread |
| `num_threads(n)` | Menentukan jumlah thread |

***Trap question:*** Variabel yang dideklarasikan di dalam parallel region otomatis **private**. Variabel yang dideklarasikan di luar otomatis **shared**. Tapi ini bisa di-override dengan clause.

---

## Topik 6: MPI vs OpenMP

Ini perbandingan paling penting - hampir pasti muncul di UTS.

| Aspek | MPI | OpenMP |
|-------|-----|--------|
| **Memory model** | Distributed (tiap proses punya memori sendiri) | Shared (semua thread berbagi memori) |
| **Komunikasi** | Explicit message passing (kirim/terima pesan) | Implicit lewat shared variables |
| **Unit paralelisme** | Process (coarse-grained) | Thread (fine-grained) |
| **Scalability** | Cluster, distributed systems (banyak node) | Single node, multi-core |
| **Kompleksitas** | Lebih kompleks, harus tulis send/recv | Lebih simpel, tinggal tambah pragma |
| **Use case** | Multi-node clusters | Multi-core single machine |
| **Overhead** | Network communication | Thread creation/synchronization |

***Trap question:*** Soal mungkin tanya "mana yang lebih baik?" - jawabannya **tergantung konteks**. MPI untuk multi-node, OpenMP untuk single node. Bisa juga digabung (hybrid MPI+OpenMP) untuk cluster dengan node multi-core.

> **Coarse-grained parallelism** = paralelisme di level besar (proses), komunikasi jarang tapi banyak data.
>
> **Fine-grained parallelism** = paralelisme di level kecil (thread), komunikasi sering tapi sedikit data.

---

## Topik 7: GPU Computing dan CUDA

GPU awalnya untuk grafis, tapi sekarang banyak dipakai untuk komputasi paralel karena punya ribuan core.

> **CUDA (Compute Unified Device Architecture)** = platform dan model pemrograman dari NVIDIA untuk komputasi di GPU.

### CPU vs GPU

- **CPU** = few cores (4-64), optimized for sequential tasks, complex control logic
- **GPU** = thousands of cores (ratusan-ribuan), optimized for data-parallel tasks, simple control logic
- GPU unggul di tugas **data-parallel** - operasi yang sama diterapkan ke banyak elemen data

> **Data-parallel** = pola komputasi di mana operasi yang sama dilakukan secara bersamaan pada banyak elemen data berbeda. Contoh: menambah 1 ke setiap elemen array.

### Model Pemrograman CUDA

CUDA membagi komputasi antara dua "device":

| Istilah | Hardware | Peran |
|---------|----------|-------|
| **Host** | CPU + RAM | Menjalankan kode sekuensial, mengatur GPU |
| **Device** | GPU + VRAM | Menjalankan kernel (kode paralel) |

Alur kerja CUDA:
1. Alokasi memori di GPU (`cudaMalloc`)
2. Copy data dari CPU ke GPU (`cudaMemcpy`, HostToDevice)
3. Jalankan kernel di GPU (`kernel<<<blocks, threads>>>`)
4. Copy hasil dari GPU ke CPU (`cudaMemcpy`, DeviceToHost)
5. Free memori GPU (`cudaFree`)

### Kernel dan Thread Hierarchy

- **Kernel** = fungsi yang dijalankan di GPU oleh banyak thread sekaligus. Ditandai dengan `__global__`
- Thread diorganisasi dalam hierarki:

```
Grid
  |-- Block 0
  |     |-- Thread 0, Thread 1, Thread 2, ...
  |-- Block 1
  |     |-- Thread 0, Thread 1, Thread 2, ...
  |-- Block 2
  ...
```

- **Grid** = kumpulan semua blocks
- **Block** = kumpulan threads yang bisa saling berbagi shared memory
- **Thread** = unit eksekusi terkecil

### Indexing Thread

Setiap thread punya ID unik yang dihitung dari:
```
idx = threadIdx.x + blockIdx.x * blockDim.x
```

| Variable | Artinya |
|----------|---------|
| `threadIdx.x` | Index thread dalam block-nya |
| `blockIdx.x` | Index block dalam grid |
| `blockDim.x` | Jumlah thread per block |

***Trap question:*** Soal sering kasih konfigurasi `<<<numBlocks, blockSize>>>` dan tanya berapa total thread. Jawabannya: **numBlocks x blockSize**. Contoh: `<<<4, 256>>>` = 4 x 256 = 1024 threads.

### Tipe Memori CUDA

*Tabel ini kritis - sering muncul di soal:*

| Memori | Scope | Kecepatan | Ukuran | Catatan |
|--------|-------|-----------|--------|---------|
| **Register** | Per thread | Paling cepat | Sangat kecil | Variabel lokal thread |
| **Shared** | Per block | Cepat | ~48KB | Thread dalam satu block bisa berbagi |
| **Global** | Seluruh grid | Lambat | GB | Memori utama GPU, semua thread bisa akses |
| **Constant** | Seluruh grid | Cepat (cached) | 64KB | Read-only, bagus untuk konstanta |
| **Texture** | Seluruh grid | Cepat (cached) | Tergantung | Optimized untuk pola akses spasial |

***Trap question:*** **Shared memory** itu per BLOCK, bukan per grid. Thread dari block berbeda TIDAK bisa saling akses shared memory. Ini sering dijadikan jebakan.

### Contoh Pola CUDA

```c
__global__ void kernel(float *d_out, float *d_in) {
    int idx = threadIdx.x + blockIdx.x * blockDim.x;
    d_out[idx] = d_in[idx] * d_in[idx];
}

int main() {
    // Alokasi memori GPU
    cudaMalloc(&d_in, size);
    cudaMalloc(&d_out, size);

    // Copy data CPU -> GPU
    cudaMemcpy(d_in, h_in, size, cudaMemcpyHostToDevice);

    // Jalankan kernel
    kernel<<<numBlocks, blockSize>>>(d_out, d_in);

    // Copy hasil GPU -> CPU
    cudaMemcpy(h_out, d_out, size, cudaMemcpyDeviceToHost);
}
```

### Sifat Penting GPU/CUDA

- Blocks bisa berjalan di urutan apapun - ini yang bikin GPU scalable (tambah SM, tambah performance)
- Thread dalam satu block bisa disinkronisasi dengan `__syncthreads()`
- Thread dari block berbeda TIDAK bisa disinkronisasi langsung

---

## Tips Menghadapi UTS

Rangkuman jebakan umum dan strategi menjawab soal pilihan ganda:

### Jebakan yang Sering Muncul

- **MPP vs SMP** - MPP = shared-nothing + banyak OS. SMP = shared-everything + satu OS. Jangan kebalik
- **Bcast vs Scatter** - Bcast kirim data SAMA ke semua. Scatter BAGI data berbeda ke tiap proses
- **Reduce vs Allreduce** - Reduce hasilnya di satu proses. Allreduce hasilnya di semua proses
- **MPI_Comm_rank vs MPI_Comm_size** - rank = ID proses (mulai 0). size = total jumlah proses
- **critical vs atomic (OpenMP)** - atomic lebih ringan, untuk operasi sederhana. critical lebih general
- **Shared memory CUDA** - scope-nya per BLOCK, bukan per grid
- **private vs shared (OpenMP)** - variabel di dalam parallel region otomatis private, di luar otomatis shared
- **scontrol vs srun (SLURM)** - scontrol = admin tool, srun = user tool

### Strategi Menjawab

- Kalau soal tanya tentang **memory model**, identifikasi dulu: distributed (MPI) atau shared (OpenMP/CUDA)
- Kalau soal tentang **komunikasi MPI**, gambarkan di kertas: siapa kirim, siapa terima, data apa
- Kalau soal tentang **CUDA thread indexing**, hitung pakai rumus: `threadIdx.x + blockIdx.x * blockDim.x`
- Kalau soal tanya **jumlah total thread CUDA**, kalikan: `numBlocks x blockSize`
- Kalau ragu antara dua jawaban yang mirip, cari **kata kunci pembeda** - sering ada satu kata yang bikin salah satu jawaban jelas salah
- Perhatikan kata "BUKAN" atau "KECUALI" di soal - ini sering bikin salah baca

### Topik yang Paling Sering Keluar

1. **Perbandingan MPI vs OpenMP** - hampir pasti ada
2. **Fungsi-fungsi collective MPI** (Bcast, Scatter, Gather, Reduce) - pahami perbedaannya
3. **Arsitektur paralel** (MPP vs SMP vs Cluster vs Distributed) - hafal tabelnya
4. **CUDA memory hierarchy** - register, shared, global
5. **CUDA thread indexing** - rumus menghitung index
6. **Komponen cluster** dan fungsinya
7. **SLURM** - fungsi utama dan tools-nya
